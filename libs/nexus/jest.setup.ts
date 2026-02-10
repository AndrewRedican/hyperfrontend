import { TextEncoder, TextDecoder } from 'node:util'

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
})
