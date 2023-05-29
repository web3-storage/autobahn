// import * as route53 from '@aws-cdk/aws-route53'
// import * as acm from '@aws-cdk/aws-certificatemanager'
// import * as cloudfront from '@aws-cdk/aws-cloudfront'
// import * as origins from '@aws-cdk/aws-cloudfront-origins'
import { Function } from 'sst/constructs'
import { getApiPackageJson, getGitInfo } from './config.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * @param {import('sst/constructs').StackContext} config
 */
export function API ({ stack, app }) {
  const { SENTRY_DSN, DYNAMO_REGION, DYNAMO_TABLE, S3_REGIONS } = process.env
  if (!DYNAMO_REGION || !DYNAMO_TABLE || !S3_REGIONS) {
    throw new Error('DYNAMO_REGION, DYNAMO_TABLE, S3_REGIONS required in env')
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
      BRANCH: git.branch,
      COMMIT: git.commit,
      STAGE: stack.stage,
      SENTRY_DSN: SENTRY_DSN ?? '',
      DYNAMO_REGION,
      DYNAMO_TABLE,
      S3_REGIONS
    }
  })

  fun.attachPermissions(['s3:GetObject', 'dynamodb:Query'])

  // if (!fun.url) {
  //   throw new Error('Lambda Function URL is required to create cloudfront distribution')
  // }

  // const rootDomain = 'autobahn.dag.haus'
  // const domainName = domainForStage(stack.stage, rootDomain)

  // // Look up zone info. Zone must already exist. Create it in route53, and add NS records to cloudflare (as needed)
  // // @ts-expect-error sst.Stack type missing props that cdk.Stack expects
  // const hostedZone = route53.HostedZone.fromLookup(stack, 'Zone', { domainName: rootDomain })

  // // ask aws to generate a cert for domain (or fetch existing one)
  // // @ts-expect-error sst.Stack type missing props that cdk.Stack expects
  // const cert = new acm.DnsValidatedCertificate(stack, 'fun-cert', { domainName, hostedZone })

  // // create cloudfront dist to sit in front of lambda url
  // // @ts-expect-error sst.Stack type missing props that cdk.Stack expects
  // const dist = new cloudfront.Distribution(stack, 'fun-dist', {
  //   certificate: cert,
  //   domainNames: [domainName],
  //   defaultBehavior: {
  //     origin: new origins.HttpOrigin(fun.url)
  //   }
  // })

  // stack.addOutputs({
  //   url: `https://${domainName}`,
  //   fn: fun.url,
  //   cf: dist.distributionDomainName
  // })
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
