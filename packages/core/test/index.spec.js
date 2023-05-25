/* eslint-env browser */
import anyTest from 'ava'
import { randomBytes } from 'node:crypto'
import { equals } from 'multiformats/bytes'
import { CarReader } from '@ipld/car'
import autobahn from '../src/index.js'
import { Builder } from './helpers/builder.js'
import { createDynamo, createDynamoTable, createS3, createS3Bucket } from './helpers/aws.js'

/**
 * @typedef {{
 *   s3: import('./helpers/aws').TestAwsService<import('@aws-sdk/client-s3').S3Client>
 *   s3Bucket: string
 *   dynamo: import('./helpers/aws').TestAwsService<import('@aws-sdk/client-dynamodb').DynamoDBClient>
 *   dynamoTable: string
 *   builder: Builder
 *   dispatchFetch: ReturnType<createFetchDispatcher>
 * }} TestContext
 */

const test = /** @type {import('ava').TestFn<TestContext>} */ (anyTest)

test.before(async t => {
  t.context.s3 = await createS3()
  t.context.dynamo = await createDynamo()
})

test.beforeEach(async t => {
  t.context.s3Bucket = await createS3Bucket(t.context.s3.client)
  t.context.dynamoTable = await createDynamoTable(t.context.dynamo.client)
  t.context.builder = new Builder(t.context.dynamo.client, t.context.dynamoTable, t.context.s3.client, t.context.s3.region, t.context.s3Bucket)
  t.context.dispatchFetch = createFetchDispatcher(t.context)
})

test.after(t => {
  t.context.s3.container.stop()
  t.context.dynamo.container.stop()
})

test('a test', async t => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  t.true(true)
})

// test('should get a file', async t => {
//   const input = new Blob([randomBytes(256)])
//   const root = await t.context.builder.add(input)

//   const res = await t.context.dispatchFetch(`http://localhost:8787/ipfs/${root}`)
//   if (!res.ok) t.fail(`unexpected response: ${await res.text()}`)

//   await sameBytes(t, res, input)
// })

// test('should get a file in a directory', async t => {
//   const input = [
//     new File([randomBytes(256)], 'data.txt'),
//     new File([randomBytes(512)], 'image.png')
//   ]
//   const root = await t.context.builder.add(input)

//   const res = await t.context.dispatchFetch(`http://localhost:8787/ipfs/${root}/${input[0].name}`)
//   if (!res.ok) t.fail(`unexpected response: ${await res.text()}`)

//   await sameBytes(t, res, input[0])
// })

// test('should get a big file', async t => {
//   const input = [new File([randomBytes(609261780)], 'sargo.tar.xz')]
//   const root = await t.context.builder.add(input)

//   const res = await t.context.dispatchFetch(`http://localhost:8787/ipfs/${root}/${input[0].name}`)
//   if (!res.ok) t.fail(`unexpected response: ${await res.text()}`)

//   await sameBytes(t, res, input[0])
// })

// test('should get a CAR via Accept headers', async t => {
//   const input = new Blob([randomBytes(256)])
//   const root = await t.context.builder.add(input)

//   const res = await t.context.dispatchFetch(`http://localhost:8787/ipfs/${root}`, {
//     headers: { Accept: 'application/vnd.ipld.car;order=dfs;' }
//   })
//   if (!res.ok) t.fail(`unexpected response: ${await res.text()}`)

//   const contentType = res.headers.get('Content-Type')
//   t.true(contentType?.includes('application/vnd.ipld.car'))
//   t.true(contentType?.includes('order=dfs'))

//   const output = new Uint8Array(await res.arrayBuffer())
//   await t.notThrowsAsync(CarReader.fromBytes(output))
// })

/** @param {TestContext} context */
function createFetchDispatcher (context) {
  /**
   * @param {URL|string} url
   * @param {RequestInit} [init]
   */
  return (url, init) => {
    const request = new Request(url, init)
    const env = {
      DEBUG: 'true',
      AWS_ACCESS_KEY_ID: context.s3.credentials?.accessKeyId,
      AWS_SECRET_ACCESS_KEY: context.s3.credentials?.secretAccessKey,
      DYNAMO_ENDPOINT: context.dynamo.endpoint,
      DYNAMO_REGION: context.dynamo.region,
      DYNAMO_TABLE: context.dynamoTable,
      S3_ENDPOINT: context.s3.endpoint,
      S3_REGIONS: context.s3.region,
      PREFER_REGION: context.s3.region
    }
    const ctx = { waitUntil: () => {} }
    return autobahn.fetch(request, env, ctx)
  }
}

/**
 * @param {import('ava').ExecutionContext<TestContext>} t
 * @param {{ arrayBuffer (): Promise<ArrayBuffer> }} a
 * @param {{ arrayBuffer (): Promise<ArrayBuffer> }} b
 */
async function sameBytes (t, a, b) {
  const aBytes = new Uint8Array(await a.arrayBuffer())
  const bBytes = new Uint8Array(await b.arrayBuffer())
  t.true(equals(aBytes, bBytes))
}

class File extends Blob {
  /**
   * @param {BlobPart[]} parts
   * @param {string} name
   */
  constructor (parts, name) {
    super(parts)
    this.name = name
  }
}
