<div align="center">
  <img src="https://bafybeicrttclnbsndlwv7p4ijzlsx7zzchkk3ahsc4slptfpwk73aicibe.ipfs.w3s.link/logo-autobahn.png" width="150" />
  <h1>autobahn</h1>
</div>

🧪 Experimental Trustless IPFS HTTP gateway providing access to UnixFS data via CAR CIDs.

How it works:

1. Extract `DATA_CID` from URL.
1. Lookup block index information in DyanmoDB
1. UnixFS export directly from S3 buckets using index data to locate block positions.

The search parameter `?origin` can optionally provide the hint of which CAR file(s) the data DAG is contained within. e.g.

```
https://autobahn.dag.haus/ipfs/bafybeiaaxqlnwlfeirgr5p63ftnfszmerttupnwrim52h4zv2tfpntbjdy/data.txt?origin=bagbaieralsmnkvhi3t3d7lek2ti2vhfglb4bhw7gite2qsz467zjuqvbvyva
```

[Read MOAR](READMOAR.md)

## Getting Started

The repo contains the infra deployment code and the service implementation.

```
├── packages   - autobahn core and lambda wrapper
└── stacks     - sst and aws cdk code to deploy all the things
```

To work on this codebase **you need**:

- Node.js >= v18 (prod env is node v18)
- An AWS account with the AWS CLI configured locally
- Copy `.env.tpl` to `.env` and fill in the blanks
- Install the deps with `npm i`

Deploy dev services to your aws account and start dev console. You may need to provide a `--profile` to pick the aws profile to deploy with.

```console
npm start
```

See: https://docs.sst.dev for more info on how things get deployed.


## Environment variables

The following should be set in the env when deploying. Copy `.env.tpl` to `.env` to set in dev.

```sh
SENTRY_DSN=<your error reporting key here>

# Name of the "blocks-cars-position" table in DynamoDB
DYNAMO_TABLE=<table name here>

# Region of the DynamoDB to query
DYNAMO_REGION=us-west-2

# (optional) CSV of S3 regions of buckets that CAR files are stored in
S3_REGIONS=us-east-1,us-east-2,us-west-2
```

## Contributing

Feel free to join in. All welcome. Please read our [contributing guidelines](https://github.com/web3-storage/autobahn/blob/main/CONTRIBUTING.md) and/or [open an issue](https://github.com/web3-storage/autobahn/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/web3-storage/autobahn/blob/main/LICENSE.md)
