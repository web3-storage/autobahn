import { Function } from 'sst/constructs'
import { getApiPackageJson, getGitInfo } from './config.js'

/**
 * @param {import('sst/constructs').StackContext} config
 */
export function API ({ stack }) {
  const SENTRY_DSN = process.env.SENTRY_DSN ?? ''
  const pkg = getApiPackageJson()
  const git = getGitInfo()
  stack.setDefaultFunctionProps({
    environment: {
      SENTRY_DSN,
      NAME: pkg.name,
      REPO: pkg.homepage,
      VERSION: pkg.version,
      BRANCH: git.branch,
      COMMIT: git.commit,
      STAGE: stack.stage
    },
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
    }
  })

  fn.attachPermissions(['s3:GetObject', 'dynamodb:Query'])

  stack.addOutputs({
    URL: fn.url
  })
}
