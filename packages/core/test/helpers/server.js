import http from 'node:http'
import { handler } from '../../src/handler.node.js'

const port = parseInt(process.env.PORT ?? '3000')
http.createServer(handler).listen(port, () => console.log(`Listening on :${port}`))
