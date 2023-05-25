import type { CID } from 'multiformats/cid'
import type { Context } from '@web3-storage/gateway-lib'
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { S3Client } from '@aws-sdk/client-s3'

export interface Environment {
  DEBUG: string
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  DYNAMO_REGION: string
  DYNAMO_TABLE: string
  S3_REGIONS: string
  PREFER_REGION: string
}

export interface DynamoContext extends Context {
  dynamoClient: DynamoDBClient
  dynamoTable: string
}

export type RegionalS3Clients = Record<string, S3Client>

export interface S3Context extends Context {
  s3Clients: RegionalS3Clients
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
