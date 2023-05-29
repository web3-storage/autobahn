import * as route53 from 'aws-cdk-lib/aws-route53'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { Function } from 'sst/constructs'
import { getApiPackageJson, getGitInfo } from './config.js'
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
    return stack.addOutputs({
      fn: fun.url
    })
  }

  // <stage>.autobahn.dag.haus | autobahn.dag.haus
  const domainName = domainForStage(stack.stage, HOSTED_ZONE)

  // Import existing Zone
  const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'fun-zone', {
    zoneName: `${HOSTED_ZONE}.`,
    hostedZoneId: HOSTED_ZONE_ID
  })

  // ask aws to generate a cert for domain (or fetch existing one)
  const cert = new acm.Certificate(stack, 'fun-cert', {
    domainName,
    validation: acm.CertificateValidation.fromDns(hostedZone)
  })

  // create cloudfront dist to sit in front of lambda url
  const dist = new cloudfront.Distribution(stack, 'fun-dist', {
    certificate: cert,
    domainNames: [domainName],
    defaultBehavior: {
      origin: new origins.HttpOrigin(new URL(fun.url).origin)
    }
  })

  stack.addOutputs({
    url: `https://${domainName}`,
    fn: fun.url,
    cf: dist.distributionDomainName
  })
}

/**
 * @param {string} stage
 * @param {string} rootDomain
 */
function domainForStage (stage, rootDomain) {
  if (stage === 'prod') {
    return rootDomain
  }
  return `${stage}.${rootDomain}`
}
