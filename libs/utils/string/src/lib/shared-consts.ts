export const ENCODER = new TextEncoder()
export const UTF8_DECODER = new TextDecoder('utf8')

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
    ARRAY: new Uint8Array([104, 101, 108, 108, 111]),
  },
  NON_ASCII: {
    STRING: 'こんにちは',
    ARRAY: new Uint8Array([
      227,
      129,
      147, // こ
      227,
      130,
      147, // ん
      227,
      129,
      171, // に
      227,
      129,
      161, // ち
      227,
      129,
      175, // は
    ]),
  },
  EMPTY: {
    STRING: '',
    ARRAY: new Uint8Array([]),
  },
}
