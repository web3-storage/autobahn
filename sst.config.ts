import { SSTConfig } from "sst"
import { Tags } from "aws-cdk-lib"
import { API } from "./stacks/api.js"

export default {
  config(_input) {
    return {
      name: "autobahn",
      region: "us-east-1",
    };
  },
  stacks(app) {
    // tags let us discover all the aws resource costs incurred by this app
    // see: https://docs.sst.dev/advanced/tagging-resources
    Tags.of(app).add('Project', 'autobahn')
    Tags.of(app).add('Repository', 'https://github.com/web3-storage/autobahn')
    Tags.of(app).add('Environment', `${app.stage}`)
    Tags.of(app).add('ManagedBy', 'SST')

    app.stack(API)
  }
} satisfies SSTConfig
