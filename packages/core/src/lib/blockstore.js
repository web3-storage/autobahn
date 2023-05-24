import { readBlockHead, asyncIterableReader } from '@ipld/car/decoder'
import { base58btc } from 'multiformats/bases/base58'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import defer from 'p-defer'
import retry from 'p-retry'
import { DynamoIndex } from './block-index.js'
import { OrderedCarBlockBatcher } from './block-batch.js'

/**
 * @typedef {import('cardex/mh-index-sorted').IndexEntry} IndexEntry
 * @typedef {string} MultihashString
 * @typedef {import('dagula').Block} Block
 * @typedef {import('../bindings.js').R2Bucket} R2Bucket
 */

/**
 * A blockstore that is backed by a DynamoDB index and S3 buckets.
 */
export class DynamoBlockstore {
  /**
   * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} dynamoClient 
   * @param {string} dynamoTable
   * @param {import('../bindings').RegionalS3Clients} s3Clients
   */
  constructor (dynamoClient, dynamoTable, s3Clients) {
    this._buckets = s3Clients
    /** @type {import('./block-index').BlockIndex} */
    this._idx = new DynamoIndex(dynamoClient, dynamoTable)
  }

  /** @param {import('multiformats').UnknownLink} cid */
  async get (cid) {
    // console.log(`get ${cid}`)
    const idxEntries = await this._idx.get(cid)
    if (!idxEntries.length) return
    const { region, bucket, key, offset, length } = idxEntries[0]

    const s3Client = this._buckets[region]
    if (!s3Client) return

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=${offset}-${offset + length - 1}`
    })
    const res = await s3Client.send(command)
    if (!res.Body) return

    const bytes = await res.Body.transformToByteArray()
    return { cid, bytes }
  }
}

export class BatchingDynamoBlockstore extends DynamoBlockstore {
  /** @type {Map<string, Array<import('p-defer').DeferredPromise<Block|undefined>>>} */
  #pendingBlocks = new Map()

  /** @type {import('./block-batch').BlockBatcher} */
  #batcher = new OrderedCarBlockBatcher()

  #scheduled = false

  /** @type {Promise<void>|null} */
  #processing = null

  #scheduleBatchProcessing () {
    if (this.#scheduled) return
    this.#scheduled = true

    const startProcessing = async () => {
      this.#scheduled = false
      const { promise, resolve } = defer()
      this.#processing = promise
      try {
        await this.#processBatch()
      } finally {
        this.#processing = null
        resolve()
      }
    }

    // If already running, then start when finished
    if (this.#processing) {
      return this.#processing.then(startProcessing)
    }

    // If not running, then start on the next tick
    setTimeout(startProcessing)
  }

  async #processBatch () {
    console.log('processing batch')
    const batcher = this.#batcher
    this.#batcher = new OrderedCarBlockBatcher()
    const pendingBlocks = this.#pendingBlocks
    this.#pendingBlocks = new Map()

    /**
     * @param {import('multiformats').UnknownLink} cid 
     * @param {Uint8Array} bytes 
     */
    const resolvePendingBlock = (cid, bytes) => {
      const key = mhToKey(cid.multihash.bytes)
      const blocks = pendingBlocks.get(key)
      if (!blocks) return
      console.log(`got wanted block ${cid} (${pendingBlocks.size} remaining)`)
      const block = { cid, bytes }
      blocks.forEach(b => b.resolve(block))
      pendingBlocks.delete(key)
    }

    while (true) {
      const batch = batcher.next()
      if (!batch.length) break

      batch.sort((a, b) => a.offset - b.offset)

      const { region, bucket, key } = batch[0]
      const range = `bytes=${batch[0].offset}-${batch[batch.length - 1].offset + batch[batch.length - 1].length - 1}`

      console.log(`fetching ${batch.length} blocks from s3://${region}/${bucket}/${key} (${range})`)
      const s3Client = this._buckets[region]
      if (!s3Client) return

      const res = await retry(async () => {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          Range: range
        })
        return await s3Client.send(command)
      }, { minTimeout: 100, onFailedAttempt: err => console.warn(`failed S3 query for: s3://${region}/${bucket}/${key} (${range})`, err) })

      if (!res.Body) {
        // should not happen, but if it does, we need to resolve `undefined`
        // for the blocks in this batch - they are not found.
        for (const blocks of pendingBlocks.values()) {
          blocks.forEach(b => b.resolve())
        }
        return
      }

      const reader = res.Body.transformToWebStream().getReader()
      const bytesReader = asyncIterableReader((async function * () {
        while (true) {
          const { done, value } = await reader.read()
          if (done) return
          yield value
        }
      })())

      const bytes = await bytesReader.exactly(batch[0].length)
      bytesReader.seek(batch[0].length)
      resolvePendingBlock(batch[0].cid, bytes)

      while (true) {
        try {
          const blockHeader = await readBlockHead(bytesReader)
          const bytes = await bytesReader.exactly(blockHeader.blockLength)
          bytesReader.seek(blockHeader.blockLength)
          resolvePendingBlock(blockHeader.cid, bytes)
        } catch {
          break
        }
      }
      // we should have read all the bytes from the reader by now but if the
      // bytesReader throws for bad data _before_ the end then we need to
      // cancel the reader - we don't need the rest.
      reader.cancel()
    }

    // resolve `undefined` for any remaining blocks
    for (const blocks of pendingBlocks.values()) {
      blocks.forEach(b => b.resolve())
    }
  }

  /** @param {import('multiformats').UnknownLink} cid */
  async get (cid) {
    // console.log(`get ${cid}`)
    const idxEntries = await this._idx.get(cid)
    if (!idxEntries.length) return

    this.#batcher.add(cid, idxEntries)
    const key = mhToKey(cid.multihash.bytes)
    let blocks = this.#pendingBlocks.get(key)
    if (!blocks) {
      blocks = []
      this.#pendingBlocks.set(key, blocks)
    }

    const deferred = defer()
    blocks.push(deferred)
    this.#scheduleBatchProcessing()
    return deferred.promise
  }
}

const mhToKey = (/** @type {Uint8Array} */ mh) => base58btc.encode(mh)
