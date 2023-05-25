# Region of the DynamoDB to query
DYNAMO_REGION=us-west-2
# Name of the "blocks-cars-position" table in DynamoDB
DYNAMO_TABLE=<table name here>
# (optional) CSV of S3 regions of buckets that CAR files are stored in
S3_REGIONS=us-east-2,us-west-2
# (optional) preferred region to fetch data from - typically same place as
# where the lambda is running
PREFER_REGION=us-west-2
