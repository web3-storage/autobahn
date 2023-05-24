/* eslint-env browser */
import { Dagula } from 'dagula'
import { CarReader } from '@ipld/car'
import { HttpError, toIterable } from '@web3-storage/gateway-lib/util'
import { DynamoBlockstore } from './lib/blockstore.js'
import { version } from '../package.json'
import { S3Client } from '@aws-sdk/client-s3'

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
 * @type {import('@web3-storage/gateway-lib').Middleware<DynamoContext, import('@web3-storage/gateway-lib').Context>}
 */
export function withDynamoClient (handler) {

}

/**
 * Instantiates regional S3 clients from the environment variables.
 * @type {import('@web3-storage/gateway-lib').Middleware<DynamoContext, import('@web3-storage/gateway-lib').Context>}
 */
export function withS3Clients (handler) {
  return async (request, env, ctx) => {
    /** @type {import('./bindings.js').RegionalS3Clients} */
    const s3Clients = {
      'us-west-2': new S3Client({ region: 'us-west-2' }),
      'us-east-2': new S3Client({ region: 'us-east-2' })
    }
    return handler(request, env, { ...ctx, s3Clients })
  }
}

/**
 * Creates a dagula instance backed by the DynamoDB blockstore.
 * @type {import('@web3-storage/gateway-lib').Middleware<DagulaContext & DynamoContext & S3Context & IpfsUrlContext, DynamoContext & S3Context & IpfsUrlContext, Environment>}
 */
export function withDagula (handler) {
  return async (request, env, ctx) => {
    /** @type {import('dagula').Blockstore?} */
    const blockstore = new DynamoBlockstore(ctx.dynamoClient, ctx.s3Clients)
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
    response.headers.set('x-autobahn-version', version)
    return response
  }
}
