import { readBlockHead, asyncIterableReader } from '@ipld/car/decoder'
// import { base58btc } from 'multiformats/bases/base58'
// import defer from 'p-defer'
import { DynamoIndex } from './block-index.js'
// import { OrderedCarBlockBatcher } from './block-batch.js'
import { GetObjectCommand } from '@aws-sdk/client-s3'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('cardex/mh-index-sorted').IndexEntry} IndexEntry
 * @typedef {string} MultihashString
 * @typedef {import('dagula').Block} Block
 * @typedef {import('../bindings.js').R2Bucket} R2Bucket
 */

// 2MB (max safe libp2p block size) + typical block header length + some leeway
// const MAX_ENCODED_BLOCK_LENGTH = (1024 * 1024 * 2) + 39 + 61

/**
 * A blockstore that is backed by a DynamoDB index and S3 buckets.
 */
export class SimpleDynamoBlockstore {
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

  /** @param {CID} cid */
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

// export class DynamoBlockstore extends SimpleDynamoBlockstore {
//   /** @type {Map<string, Array<import('p-defer').DeferredPromise<Block|undefined>>>} */
//   #pendingBlocks = new Map()

//   /** @type {import('./block-batch.js').BlockBatcher} */
//   #batcher = new OrderedCarBlockBatcher()

//   #scheduled = false

//   /** @type {Promise<void>|null} */
//   #processing = null

//   #scheduleBatchProcessing () {
//     if (this.#scheduled) return
//     this.#scheduled = true

//     const startProcessing = async () => {
//       this.#scheduled = false
//       const { promise, resolve } = defer()
//       this.#processing = promise
//       try {
//         await this.#processBatch()
//       } finally {
//         this.#processing = null
//         resolve()
//       }
//     }

//     // If already running, then start when finished
//     if (this.#processing) {
//       return this.#processing.then(startProcessing)
//     }

//     // If not running, then start on the next tick
//     setTimeout(startProcessing)
//   }

//   async #processBatch () {
//     console.log('processing batch')
//     const batcher = this.#batcher
//     this.#batcher = new OrderedCarBlockBatcher()
//     const pendingBlocks = this.#pendingBlocks
//     this.#pendingBlocks = new Map()

//     while (true) {
//       const batch = batcher.next()
//       if (!batch.length) break

//       batch.sort((a, b) => a.offset - b.offset)

//       const { carCid } = batch[0]
//       const carPath = `${carCid}/${carCid}.car`
//       const range = {
//         offset: batch[0].offset,
//         length: batch[batch.length - 1].offset - batch[0].offset + MAX_ENCODED_BLOCK_LENGTH
//       }

//       console.log(`fetching ${batch.length} blocks from ${carCid} (${range.length} bytes @ ${range.offset})`)
//       const res = await this._dataBucket.get(carPath, { range })
//       if (!res) {
//         // should not happen, but if it does, we need to resolve `undefined`
//         // for the blocks in this batch - they are not found.
//         for (const blocks of pendingBlocks.values()) {
//           blocks.forEach(b => b.resolve())
//         }
//         return
//       }

//       const reader = res.body.getReader()
//       const bytesReader = asyncIterableReader((async function * () {
//         while (true) {
//           const { done, value } = await reader.read()
//           if (done) return
//           yield value
//         }
//       })())

//       while (true) {
//         try {
//           const blockHeader = await readBlockHead(bytesReader)
//           const bytes = await bytesReader.exactly(blockHeader.blockLength)
//           bytesReader.seek(blockHeader.blockLength)

//           const key = mhToKey(blockHeader.cid.multihash.bytes)
//           const blocks = pendingBlocks.get(key)
//           if (blocks) {
//             // console.log(`got wanted block for ${blockHeader.cid}`)
//             const block = {
//               cid: blockHeader.cid,
//               bytes
//             }
//             blocks.forEach(b => b.resolve(block))
//             pendingBlocks.delete(key)
//           }
//         } catch {
//           break
//         }
//       }
//       // we should have read all the bytes from the reader by now but if the
//       // bytesReader throws for bad data _before_ the end then we need to
//       // cancel the reader - we don't need the rest.
//       reader.cancel()
//     }

//     // resolve `undefined` for any remaining blocks
//     for (const blocks of pendingBlocks.values()) {
//       blocks.forEach(b => b.resolve())
//     }
//   }

//   /** @param {CID} cid */
//   async get (cid) {
//     // console.log(`get ${cid}`)
//     const multiIdxEntry = await this._idx.get(cid)
//     if (!multiIdxEntry) return

//     const [carCid, entry] = multiIdxEntry
//     this.#batcher.add({ carCid, blockCid: cid, offset: entry.offset })

//     if (!entry.multihash) throw new Error('missing entry multihash')
//     const key = mhToKey(entry.multihash.bytes)
//     let blocks = this.#pendingBlocks.get(key)
//     if (!blocks) {
//       blocks = []
//       this.#pendingBlocks.set(key, blocks)
//     }
//     const deferred = defer()
//     blocks.push(deferred)
//     this.#scheduleBatchProcessing()
//     return deferred.promise
//   }
// }

// const mhToKey = (/** @type {Uint8Array} */ mh) => base58btc.encode(mh)
