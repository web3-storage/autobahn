/* eslint-env browser */
import { Dagula } from 'dagula'
import { HttpError } from '@web3-storage/gateway-lib/util'
import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchingDynamoBlockstore } from './lib/blockstore.js'
import pkg from '../package.json' assert { type: 'json' }

/**
 * @typedef {import('./bindings.js').Environment} Environment
 * @typedef {import('@web3-storage/gateway-lib').IpfsUrlContext} IpfsUrlContext
 * @typedef {import('./bindings.js').DynamoContext} DynamoContext
 * @typedef {import('./bindings.js').S3Context} S3Context
 * @typedef {import('@web3-storage/gateway-lib').DagulaContext} DagulaContext
 */

/**
 * Validates the request does not contain unsupported features.
 * Returns 501 Not Implemented in case it has.
 * @type {import('@web3-storage/gateway-lib').Middleware<import('@web3-storage/gateway-lib').Context>}
 */
export function withUnsupportedFeaturesHandler (handler) {
  return (request, env, ctx) => {
    // Range request https://github.com/web3-storage/gateway-lib/issues/12
    if (request.headers.get('range')) {
      throw new HttpError('Not Implemented', { status: 501 })
    }

    return handler(request, env, ctx)
  }
}

/**
 * Instantiates a DynamoDB client from the environment variables.
 * @type {import('@web3-storage/gateway-lib').Middleware<DynamoContext, import('@web3-storage/gateway-lib').Context, Environment>}
 */
export function withDynamoClient (handler) {
  return async (request, env, ctx) => {
    if (!env.DYNAMO_REGION) throw new Error('missing environment variable: DYNAMO_REGION')
    if (!env.DYNAMO_TABLE) throw new Error('missing environment variable: DYNAMO_TABLE')
    const credentials = getAwsCredentials(env)
    const endpoint = env.DYNAMO_ENDPOINT
    const dynamoClient = new DynamoDBClient({ endpoint, region: env.DYNAMO_REGION, credentials })
    return handler(request, env, { ...ctx, dynamoClient, dynamoTable: env.DYNAMO_TABLE })
  }
}

/**
 * Instantiates regional S3 clients from the environment variables.
 * @type {import('@web3-storage/gateway-lib').Middleware<S3Context, import('@web3-storage/gateway-lib').Context, Environment>}
 */
export function withS3Clients (handler) {
  return async (request, env, ctx) => {
    const regions = env.S3_REGIONS ? env.S3_REGIONS.split(',') : ['us-west-2', 'us-east-1', 'us-east-2']
    const endpoint = env.S3_ENDPOINT
    const credentials = getAwsCredentials(env)
    const config = { endpoint, forcePathStyle: !!endpoint, credentials }
    const s3Clients = Object.fromEntries(regions.map(r => [r, new S3Client({ ...config, region: r })]))
    return handler(request, env, { ...ctx, s3Clients })
  }
}

/** @param {Environment} env */
function getAwsCredentials (env) {
  const accessKeyId = env.AWS_ACCESS_KEY_ID
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
}

/**
 * Creates a dagula instance backed by the DynamoDB blockstore.
 * @type {import('@web3-storage/gateway-lib').Middleware<DagulaContext & DynamoContext & S3Context & IpfsUrlContext, DynamoContext & S3Context & IpfsUrlContext, Environment>}
 */
export function withDagula (handler) {
  return async (request, env, ctx) => {
    const blockstore = new BatchingDynamoBlockstore(ctx.dynamoClient, ctx.dynamoTable, ctx.s3Clients, { preferRegion: env.PREFER_REGION })
    const dagula = new Dagula(blockstore)
    return handler(request, env, { ...ctx, dagula })
  }
}

/**
 * @type {import('@web3-storage/gateway-lib').Middleware<import('@web3-storage/gateway-lib').Context>}
 */
export function withVersionHeader (handler) {
  return async (request, env, ctx) => {
    const response = await handler(request, env, ctx)
    response.headers.set('x-autobahn-version', pkg.version)
    return response
  }
}
