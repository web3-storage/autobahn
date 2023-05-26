# autobahn-core

## Getting started

Create a `.env` file in this directory and add the following information:

```sh
# AWS credentials, they require access to the DynamoDB table and the S3 buckets
# data in the table references.
AWS_ACCESS_KEY_ID=*****
AWS_SECRET_ACCESS_KEY=*****

# Region of the DynamoDB to query
DYNAMO_REGION=us-west-2
# Name of the "blocks-cars-position" table in DynamoDB
DYNAMO_TABLE=prod-ep-v1-blocks-cars-position
# (optional) DynamoDB endpoint - for dev/testing
DYNAMO_ENDPOINT=

# (optional) CSV S3 regions of buckets that CAR files are stored in
S3_REGIONS=us-east-1,us-east-2,us-west-2
# (optional) S3 endpoint - for dev/testing
S3_ENDPOINT=


# (optional) preferred region to fetch data from - typically same place as
# where the lambda is running
PREFER_REGION=us-west-2
```

Run the NodeJS server:

```sh
npm start
```
