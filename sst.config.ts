import { SSTConfig } from "sst"
import { API } from "./stacks/api.js"

export default {
  config(_input) {
    return {
      name: "autobahn",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(API)
  }
} satisfies SSTConfig