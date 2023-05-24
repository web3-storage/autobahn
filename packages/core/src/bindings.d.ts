import type { CID } from 'multiformats/cid'
import type { Context } from '@web3-storage/gateway-lib'
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { S3 } from '@aws-sdk/client-s3'

export interface Environment {
  DEBUG: string
}

export interface DynamoContext extends Context {
  dynamoClient: DynamoDBClient
}

export type Region = 'us-east-2'|'us-west-2'
export type RegionalS3Clients = Record<Region, S3Client>

export interface S3Context extends Context {
  s3Clients: Map<Region, S3Client>
}

export interface R2GetOptions {
  range?: {
    offset: number
    length?: number
  }
}

export interface R2ListOptions {
  prefix?: string
  cursor?: string
}

export interface R2Object {
  body: ReadableStream
  size: number
  key: string
}

export interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
}

export interface R2Bucket {
  get (k: string, o?: R2GetOptions): Promise<R2Object | null>
  head (k: string, o?: R2GetOptions): Promise<R2Object | null>
  list (o?: R2ListOptions): Promise<R2Objects | null>
}
