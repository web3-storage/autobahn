import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { streamifyResponse } from 'lambda-stream'
import autobahn from '@web3-storage/autobahn-core/index.js'

// import * as Sentry from '@sentry/serverless'

// Sentry.AWSLambda.init({
//   environment: process.env.SST_STAGE,
//   dsn: process.env.SENTRY_DSN,
//   tracesSampleRate: 1.0
// })

const text = 'text/plain; charset=utf-8'
const json = 'application/json'

/**
 * Main autobahn catch all handler / router
 * Warning: not a real proxy event. is a lambda url invocation
 * @param {import('aws-lambda').APIGatewayProxyEventV2} event
 * @param {import('lambda-stream').ResponseStream} res
 * @param {import('aws-lambda').Context} ctx
 */
export async function _handler (event, res, ctx) {
  const rawPath = event.rawPath
  if (rawPath.startsWith('/ipfs/')) {
    return getIpfs(event, res)
  }
  if (rawPath === '/version' || rawPath === '/version/') {
    return getVersion(event, res)
  }
  if (rawPath === '/error' || rawPath === '/error/') {
    throw new Error('/error deliberate error')
  }
  if (rawPath === '' || rawPath === '/') {
    return getHome(event, res)
  }
  return get404(event, res, ctx)
}

export const handler = streamifyResponse(_handler)

/**
 * @param {import('aws-lambda').APIGatewayProxyEventV2} evt
 * @param {import('lambda-stream').ResponseStream} res
 */
export async function getIpfs (evt, res) {
  const pathname = evt.rawPath || ''
  const search = evt.rawQueryString ? `?${evt.rawQueryString}` : ''
  const url = new URL(`${pathname}${search}`, `http://${evt.headers.host}`)
  const headers = new Headers(Object.entries(Headers))
  const method = evt.requestContext.http.method
  const body = undefined
  const request = new Request(url, { method, headers, body })
  const env = {
    DEBUG: process.env.DEBUG ?? 'false',
    DYNAMO_REGION: process.env.DYNAMO_REGION,
    DYNAMO_TABLE: process.env.DYNAMO_TABLE,
    S3_REGIONS: process.env.S3_REGIONS
  }
  const ctx = { waitUntil: () => {} }
  // @ts-expect-error
  const response = await autobahn.fetch(request, env, ctx)

  const contentType = response.headers.get('content-type')
  if (contentType) {
    res.setContentType(contentType)
  }

  // @ts-expect-error body may be undefined
  await pipeline(Readable.fromWeb(response.body), res)
}

/**
 * handler for GET /version
 * @param {import('aws-lambda').APIGatewayProxyEventV2} evt
 * @param {import('lambda-stream').ResponseStream} res
 */
export async function getVersion (evt, res) {
  const { NAME: name, VERSION: version, COMMIT: commit, STAGE: env, REPO: repo } = process.env
  const body = JSON.stringify({ name, version, repo, commit, env })
  res.setContentType(json)
  res.write(body)
  res.end()
}

/**
 * handler for GET /
 * @param {import('aws-lambda').APIGatewayProxyEventV2} evt
 * @param {import('lambda-stream').ResponseStream} res
 */
export async function getHome (evt, res) {
  const { VERSION, BRANCH, STAGE, REPO } = process.env
  const env = STAGE === 'prod' ? '' : `(${STAGE})`
  const repo = BRANCH === 'main' ? REPO : `${REPO}/tree/${BRANCH}`
  const body = `⁂ autobahn v${VERSION} ${env}\n- ${repo}`
  res.setContentType(text)
  res.write(body)
  res.end()
}

/**
 * @param {import('aws-lambda').APIGatewayProxyEventV2} evt
 * @param {import('lambda-stream').ResponseStream} res
 * @param {import('aws-lambda').Context} ctx
 */
export async function get404 (evt, res, ctx) {
  // res.setContentType(text)
  // // @ts-expect-error
  // res.statusCode = 404
  // res.write('\n 404 🦖 \n')
  const error = new Error('Not Found')
  // @ts-expect-error
  error.statusCode = 404
  ctx.fail(error)
}

// export const home = Sentry.AWSLambda.wrapHandler(homeGet)
// export const error = Sentry.AWSLambda.wrapHandler(errorGet)
