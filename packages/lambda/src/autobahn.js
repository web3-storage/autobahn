// import * as Sentry from '@sentry/serverless'

// Sentry.AWSLambda.init({
//   environment: process.env.SST_STAGE,
//   dsn: process.env.SENTRY_DSN,
//   tracesSampleRate: 1.0
// })

/**
 * AWS HTTP Gateway handler for GET /version
 *
 * @param {import('aws-lambda').APIGatewayProxyEventV2} request
 */
export async function getVersion (request) {
  const { NAME: name, VERSION: version, COMMIT: commit, STAGE: env, REPO: repo } = process.env
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, version, repo, commit, env })
  }
}

// export const version = Sentry.AWSLambda.wrapHandler(getVersion)

/**
 * AWS HTTP Gateway handler for GET /
 *
 * @param {import('aws-lambda').APIGatewayProxyEventV2} request
 */
export async function getHome (request) {
  const { VERSION, BRANCH, STAGE, REPO } = process.env
  const env = STAGE === 'prod' ? '' : `(${STAGE})`
  const repo = BRANCH === 'main' ? REPO : `${REPO}/tree/${BRANCH}`
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    },
    body: `⁂ autobahn v${VERSION} ${env}\n- ${repo}`
  }
}

/**
 * AWS HTTP Gateway handler for GET /error
 */
export async function getError () {
  throw new Error('API Error')
}

// export const home = Sentry.AWSLambda.wrapHandler(homeGet)
// export const error = Sentry.AWSLambda.wrapHandler(errorGet)
