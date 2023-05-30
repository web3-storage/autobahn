import * as cdk from 'aws-cdk-lib/core'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { Function } from 'sst/constructs'
import { getApiPackageJson, getGitInfo, domainForStage } from './config.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * @param {import('sst/constructs').StackContext} config
 */
export function API ({ stack, app }) {
  const { SENTRY_DSN, DYNAMO_REGION, DYNAMO_TABLE, S3_REGIONS, HOSTED_ZONE, HOSTED_ZONE_ID } = process.env
  if (!DYNAMO_REGION || !DYNAMO_TABLE || !S3_REGIONS) {
    throw new Error('DYNAMO_REGION, DYNAMO_TABLE, S3_REGIONS required in env')
  }
  if ((HOSTED_ZONE && !HOSTED_ZONE_ID) || (!HOSTED_ZONE && HOSTED_ZONE_ID)) {
    throw new Error('Both HOSTED_ZONE and HOSTED_ZONE_ID must be set to enable a custom domain')
  }

  const pkg = getApiPackageJson()
  const git = getGitInfo()
  stack.setDefaultFunctionProps({
    memorySize: '1 GB',
    runtime: 'nodejs18.x',
    architecture: 'arm_64',
    timeout: '15 minutes'
  })

  // Gotta use lambda fn url + cloudfront to get the streaming behavior we want
  // see: https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/
  const fun = new Function(stack, 'fun', {
    handler: 'packages/lambda/src/autobahn.handler',
    url: {
      cors: true,
      authorizer: 'none'
    },
    environment: {
      NAME: pkg.name,
      REPO: pkg.homepage,
      VERSION: pkg.version,
      COMMIT: git.commit,
      STAGE: stack.stage,
      SENTRY_DSN: SENTRY_DSN ?? '',
      DYNAMO_REGION,
      DYNAMO_TABLE,
      S3_REGIONS
    }
  })

  fun.attachPermissions(['s3:GetObject', 'dynamodb:Query'])

  if (!fun.url) {
    throw new Error('Lambda Function URL is required to create cloudfront distribution')
  }

  if (!HOSTED_ZONE || !HOSTED_ZONE_ID) {
    stack.addOutputs({
      functionUrl: fun.url
    })
    return
  }

  // <stage>.autobahn.dag.haus | autobahn.dag.haus
  const domainName = domainForStage(stack.stage, HOSTED_ZONE)

  // Import existing Zone
  const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'fun-zone', {
    zoneName: `${HOSTED_ZONE}.`,
    hostedZoneId: HOSTED_ZONE_ID
  })

  /**
   * We have to use the deprecated `DnsValidatedCertificate` construct here
   * - cloudfront *requires* that certs be created in `us-east-1`
   * - no other construct allows us to specify the region for the cert.
   *
   * the recommended replacement does not let us set the region for the cert:
   *
   *  const cert = new acm.Certificate(stack, 'fun-cert', {
   *    domainName,
   *    validation: acm.CertificateValidation.fromDns(hostedZone)
   *  })
   */
  const cert = new acm.DnsValidatedCertificate(stack, 'fun-cert', {
    region: 'us-east-1',
    hostedZone,
    domainName: HOSTED_ZONE,
    subjectAlternativeNames: [`*.${HOSTED_ZONE}`]
  })

  // create cloudfront dist to sit in front of lambda url
  const dist = new cloudfront.Distribution(stack, 'fun-dist', {
    certificate: cert,
    domainNames: [domainName],
    // cheapest. only deploy to USA, Canada, Europe, & Israel. see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.PriceClass.html
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    defaultBehavior: {
      compress: true,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      originRequestPolicy: new cloudfront.OriginRequestPolicy(stack, 'fun-req-policy', {
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.all(),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all()
      }),
      cachePolicy: new cloudfront.CachePolicy(stack, 'fun-cache-policy', {
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept', 'Content-Type', 'If-None-Match', 'Range'),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all()
      }),
      // fun.url is a placeholder at synth time...
      // you have to do this horror to get the hostname from the url at deploy time
      // see: https://github.com/aws/aws-cdk/blob/08ad189719f9fb3d9207f2b960ceeb7d0bd7b82b/packages/aws-cdk-lib/aws-cloudfront-origins/lib/rest-api-origin.ts#L39-L42
      origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', fun.url)))
    }
  })

  // eslint-disable-next-line
  const dns = new route53.ARecord(stack, 'fun-dns', {
    zone: hostedZone,
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(dist))
  })

  stack.addOutputs({
    url: `https://${dns.domainName}`,
    functionUrl: fun.url,
    cloudfrontUrl: `https://${dist.distributionDomainName}`
  })
}
