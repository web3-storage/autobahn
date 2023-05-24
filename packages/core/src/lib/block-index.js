import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { base58btc } from 'multiformats/bases/base58'

/**
 * @typedef {{ bucket: string, region: string, key: string, offset: number, length: number }} IndexEntry
 * @typedef {{ get: (cid: import('multiformats').UnknownLink) => Promise<IndexEntry[]> }} BlockIndex
 */

/** @implements {BlockIndex} */
export class DynamoIndex {
  #client
  #table

  /**
   * @param {import('@aws-sdk/client-dynamodb').DynamoDBClient} client 
   * @param {string} table 
   */
  constructor (client, table) {
    this.#client = client
    this.#table = table
  }

  /**
   * @param {import('multiformats').UnknownLink} cid
   * @returns {Promise<IndexEntry[]>}
   */
  async get (cid) {
    const command = new QueryCommand({
      TableName: this.#table,
      Limit: 3,
      KeyConditions: {
        blockmultihash: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{ S: base58btc.encode(cid.multihash.bytes) }],
        }
      },
      AttributesToGet: ['carpath', 'length', 'offset']
    })
    const res = await this.#client.send(command)
    return (res.Items ?? []).map(item => {
      const { carpath, offset, length } = unmarshall(item)
      const [region, bucket, ...rest] = carpath.split('/')
      return { region, bucket, key: rest.join('/'), offset, length }
    })
  }
}
