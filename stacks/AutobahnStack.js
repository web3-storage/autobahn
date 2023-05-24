import { Api } from 'sst/constructs'

/**
 * @param {import('sst/constructs').StackContext} config
 */
export function API ({ stack }) {
  const api = new Api(stack, 'api', {
    routes: {
      'GET /': 'packages/lambda/src/lambda.handler'
    }
  })
  stack.addOutputs({
    ApiEndpoint: api.url
  })
}
