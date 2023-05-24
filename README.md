# autobahn 🏁

🧪 Experimental Trustless IPFS HTTP gateway providing access to UnixFS data via CAR CIDs.

How it works:

1. Extract `DATA_CID` from URL.
1. Lookup block index information in DyanmoDB
1. UnixFS export directly from S3 buckets using index data to locate block positions.

The search parameter `?origin` can optionally provide the hint of which CAR file(s) the data DAG is contained within. e.g.

```
https://autobahn.dag.haus/ipfs/bafybeiaaxqlnwlfeirgr5p63ftnfszmerttupnwrim52h4zv2tfpntbjdy/data.txt?origin=bagbaieralsmnkvhi3t3d7lek2ti2vhfglb4bhw7gite2qsz467zjuqvbvyva
```

## Getting Started

The repo contains the infra deployment code and the service implementation.

```
├── packages   - autobahn core and lambda wrapper
└── stacks     - sst and aws cdk code to deploy all the things
```

To work on this codebase **you need**:

- Node.js >= v18 (prod env is node v18)
- An AWS account with the AWS CLI configured locally
- Copy `.env.tpl` to `.env`
- Install the deps with `npm i`

Deploy dev services to your aws account and start dev console. You may need to provide a `--profile` to pick the aws profile to deploy with.

```console
npm start
```

See: https://docs.sst.dev for more info on how things get deployed.


## Contributing

Feel free to join in. All welcome. Please read our [contributing guidelines](https://github.com/web3-storage/autobahn/blob/main/CONTRIBUTING.md) and/or [open an issue](https://github.com/web3-storage/autobahn/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/web3-storage/autobahn/blob/main/LICENSE.md)
