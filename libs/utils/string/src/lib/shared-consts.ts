import { createTextDecoder, createTextEncoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

export const ENCODER = createTextEncoder()
export const UTF8_DECODER = createTextDecoder('utf8')

export const BASE_64_ENCODING_SAMPLES = <const>{
  SIMPLE: {
    DECODED: 'Hello, World!',
    ENCODED: 'SGVsbG8sIFdvcmxkIQ==',
    ENCODED_NO_PADDING: 'SGVsbG8sIFdvcmxkIQ',
  },
  NON_ASCII: {
    DECODED: 'こんにちは',
    ENCODED: '44GT44KT44Gr44Gh44Gv',
  },
  EMPTY: {
    DECODED: '',
    ENCODED: '',
  },
}

export const UINT8_CONVERTION_SAMPLES = <const>{
  SIMPLE: {
    STRING: 'hello',
    ARRAY: createUint8Array([104, 101, 108, 108, 111]),
  },
  NON_ASCII: {
    STRING: 'こんにちは',
    ARRAY: createUint8Array([227, 129, 147, 227, 130, 147, 227, 129, 171, 227, 129, 161, 227, 129, 175]),
  },
  EMPTY: {
    STRING: '',
    ARRAY: createUint8Array([]),
  },
}
