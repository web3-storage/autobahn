# autobahn

<p>
  <a href="https://github.com/web3-storage/autobahn/actions/workflows/release.yml"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/web3-storage/autobahn/test.yml?branch=main&style=for-the-badge" /></a>
  <a href="https://discord.com/channels/806902334369824788/864892166470893588"><img src="https://img.shields.io/badge/chat-discord?style=for-the-badge&logo=discord&label=discord&logoColor=ffffff&color=7389D8" /></a>
  <a href="https://github.com/web3-storage/autobahn/blob/main/LICENSE.md"><img alt="License: Apache-2.0 OR MIT" src="https://img.shields.io/badge/LICENSE-Apache--2.0%20OR%20MIT-yellow?style=for-the-badge" /></a>
</p>

🧪 Experimental IPFS HTTP gateway providing access to UnixFS data via CAR CIDs.

How it works:

1. Extract `DATA_CID` from URL.
1. Lookup block index information in DyanmoDB
1. UnixFS export directly from S3 buckets using index data to locate block positions.

The querystring parameter `origin` can optionally provide the hint of which CAR file(s) the data DAG is contained within. e.g.

```
https://autobahn.dag.haus/ipfs/bafybeiaaxqlnwlfeirgr5p63ftnfszmerttupnwrim52h4zv2tfpntbjdy/data.txt?origin=bagbaieralsmnkvhi3t3d7lek2ti2vhfglb4bhw7gite2qsz467zjuqvbvyva
```

## Contributing

Feel free to join in. All welcome. Please read our [contributing guidelines](https://github.com/web3-storage/autobahn/blob/main/CONTRIBUTING.md) and/or [open an issue](https://github.com/web3-storage/autobahn/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/web3-storage/autobahn/blob/main/LICENSE.md)
