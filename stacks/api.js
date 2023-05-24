import { Function } from 'sst/constructs'
import { getApiPackageJson, getGitInfo } from './config.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * @param {import('sst/constructs').StackContext} config
 */
export function API ({ stack }) {
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

  // Gotta us lambda fn url + cloudfront to get the streaming behavior we want
  // see: https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/
  const fn = new Function(stack, 'fn', {
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

  fn.attachPermissions(['s3:GetObject', 'dynamodb:Query'])

  stack.addOutputs({
    URL: fn.url
  })
}
