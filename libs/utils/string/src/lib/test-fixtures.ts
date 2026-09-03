import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/**
 * Sample base64 strings paired with their decoded values for testing encoding round-trips.
 */
export const BASE_64_ENCODING_SAMPLES = {
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
} as const

/**
 * Sample strings paired with their UTF-8 byte representations for testing Uint8Array conversions.
 */
export const UINT8_CONVERTION_SAMPLES = {
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
} as const
