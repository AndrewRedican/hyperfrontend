export type { EncodingInfo } from './detect'
export {
  BINARY_SIGNATURES,
  detectEncoding,
  detectEncodingInfo,
  hasBom,
  isTextFile,
  UTF8_BOM,
  UTF8_BOM_BYTES,
  UTF16_BE_BOM_BYTES,
  UTF16_LE_BOM_BYTES,
} from './detect'
export { addBom, bufferToString, stripBom, toUtf8 } from './convert'
