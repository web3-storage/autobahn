import { Api } from 'sst/constructs'
import { getCustomDomain, getApiPackageJson, getGitInfo } from './config.js'

/**
 * @param {import('sst/constructs').StackContext} config
 */
export function API ({ stack }) {
  const SENTRY_DSN = process.env.SENTRY_DSN ?? ''
  const HOSTED_ZONE = process.env.HOSTED_ZONE
  const customDomain = getCustomDomain(stack.stage, HOSTED_ZONE)
  const pkg = getApiPackageJson()
  const git = getGitInfo()
  const api = new Api(stack, 'api', {
    customDomain,
    defaults: {
      function: {
        environment: {
          SENTRY_DSN,
          NAME: pkg.name,
          REPO: pkg.homepage,
          VERSION: pkg.version,
          BRANCH: git.branch,
          COMMIT: git.commit,
          STAGE: stack.stage
        },
        runtime: 'nodejs18.x',
        architecture: 'arm_64',
        timeout: '30 seconds' // http api max response delay is 30s see: https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html
      }
    },
    routes: {
      'GET /version': 'packages/lambda/src/autobahn.getVersion',
      'GET /error': 'packages/lambda/src/autobahn.getError',
      'GET /': 'packages/lambda/src/autobahn.getHome'
    }
  })
  stack.addOutputs({
    Domain: customDomain ? `https://${customDomain.domainName}` : 'Set HOSTED_ZONE in env to deploy to a custom domain',
    Api: api.url
  })
}