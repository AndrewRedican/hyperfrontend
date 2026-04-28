import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createScopedLogger } from '../logger'

const encodingLogger = createScopedLogger('project-scope:encoding')

/** UTF-8 BOM bytes */
export const UTF8_BOM_BYTES = <const>[0xef, 0xbb, 0xbf]

/** UTF-16 LE BOM bytes */
export const UTF16_LE_BOM_BYTES = <const>[0xff, 0xfe]

/** UTF-16 BE BOM bytes */
export const UTF16_BE_BOM_BYTES = <const>[0xfe, 0xff]

/** UTF-8 BOM string */
export const UTF8_BOM = '\uFEFF'

/**
 * Common binary file signatures.
 */
export const BINARY_SIGNATURES = <const>[
  { signature: [0x89, 0x50, 0x4e, 0x47], description: 'PNG' },
  { signature: [0xff, 0xd8, 0xff], description: 'JPEG' },
  { signature: [0x47, 0x49, 0x46, 0x38], description: 'GIF' },
  { signature: [0x50, 0x4b, 0x03, 0x04], description: 'ZIP' },
  { signature: [0x1f, 0x8b], description: 'GZIP' },
  { signature: [0x42, 0x5a, 0x68], description: 'BZIP2' },
  { signature: [0x7f, 0x45, 0x4c, 0x46], description: 'ELF' },
  { signature: [0x4d, 0x5a], description: 'EXE' },
  { signature: [0x25, 0x50, 0x44, 0x46], description: 'PDF' },
]

/**
 * Successful text-encoding detection.
 */
export type TextEncodingInfo = {
  /** Content type indicator */
  type: 'text'
  /** Character encoding */
  encoding: BufferEncoding
  /** Whether BOM was detected */
  hasBom: boolean
}

/**
 * Successful binary-content detection.
 */
export type BinaryEncodingInfo = {
  /** Content type indicator */
  type: 'binary'
  /** Binary format description */
  format?: string
}

/**
 * Encoding detection result.
 */
export type EncodingInfo = TextEncodingInfo | BinaryEncodingInfo

/**
 * Detect if content is likely text or binary with encoding information.
 *
 * @param buffer - Buffer to analyze
 * @returns Encoding information
 *
 * @example Detecting encoding and BOM info
 * ```typescript
 * const buffer = readFileSync('./document.txt')
 * const info = detectEncodingInfo(buffer)
 * if (info.type === 'text') {
 *   console.log(`Encoding: ${info.encoding}, BOM: ${info.hasBom}`)
 * }
 * ```
 */
export function detectEncodingInfo(buffer: Buffer): EncodingInfo {
  encodingLogger.debug('Detecting encoding info', { bufferSize: buffer.length })

  if (buffer.length >= 3) {
    if (buffer[0] === UTF8_BOM_BYTES[0] && buffer[1] === UTF8_BOM_BYTES[1] && buffer[2] === UTF8_BOM_BYTES[2]) {
      encodingLogger.debug('Detected UTF-8 BOM')
      return { type: 'text', encoding: 'utf-8', hasBom: true }
    }
  }

  if (buffer.length >= 2) {
    if (buffer[0] === UTF16_BE_BOM_BYTES[0] && buffer[1] === UTF16_BE_BOM_BYTES[1]) {
      encodingLogger.debug('Detected UTF-16 BE BOM')
      return { type: 'text', encoding: 'utf16le', hasBom: true }
    }
    if (buffer[0] === UTF16_LE_BOM_BYTES[0] && buffer[1] === UTF16_LE_BOM_BYTES[1]) {
      encodingLogger.debug('Detected UTF-16 LE BOM')
      return { type: 'text', encoding: 'utf16le', hasBom: true }
    }
  }

  for (const { signature, description } of BINARY_SIGNATURES) {
    if (buffer.length >= signature.length) {
      let matches = true
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          matches = false
          break
        }
      }
      if (matches) {
        encodingLogger.debug('Detected binary format by signature', { format: description })
        return { type: 'binary', format: description }
      }
    }
  }

  const sampleSize = min(buffer.length, 8000)
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) {
      encodingLogger.debug('Detected binary content (null byte found)', { position: i })
      return { type: 'binary' }
    }
  }

  encodingLogger.debug('Detected text content (UTF-8 default)')
  return { type: 'text', encoding: 'utf-8', hasBom: false }
}

/**
 * Detect file encoding from BOM or content analysis.
 *
 * @param buffer - Buffer to analyze
 * @returns Detected encoding, defaults to 'utf-8'
 *
 * @example Detecting encoding from buffer
 * ```typescript
 * const buffer = readFileSync('./data.txt')
 * const encoding = detectEncoding(buffer)
 * const content = buffer.toString(encoding)
 * ```
 */
export function detectEncoding(buffer: Buffer): BufferEncoding {
  if (buffer.length >= 3) {
    if (buffer[0] === UTF8_BOM_BYTES[0] && buffer[1] === UTF8_BOM_BYTES[1] && buffer[2] === UTF8_BOM_BYTES[2]) {
      return 'utf-8'
    }
  }

  if (buffer.length >= 2) {
    if (buffer[0] === UTF16_LE_BOM_BYTES[0] && buffer[1] === UTF16_LE_BOM_BYTES[1]) {
      return 'utf16le'
    }

    if (buffer[0] === UTF16_BE_BOM_BYTES[0] && buffer[1] === UTF16_BE_BOM_BYTES[1]) {
      return 'utf16le'
    }
  }

  return 'utf-8'
}

/**
 * Check if buffer starts with a BOM.
 *
 * @param buffer - Buffer to check
 * @returns True if buffer has a BOM
 *
 * @example Checking if buffer has BOM
 * ```typescript
 * const buffer = readFileSync('./file.txt')
 * if (hasBom(buffer)) {
 *   // Strip BOM before processing
 * }
 * ```
 */
export function hasBom(buffer: Buffer): boolean {
  if (buffer.length >= 3) {
    if (buffer[0] === UTF8_BOM_BYTES[0] && buffer[1] === UTF8_BOM_BYTES[1] && buffer[2] === UTF8_BOM_BYTES[2]) {
      return true
    }
  }

  if (buffer.length >= 2) {
    if (
      (buffer[0] === UTF16_LE_BOM_BYTES[0] && buffer[1] === UTF16_LE_BOM_BYTES[1]) ||
      (buffer[0] === UTF16_BE_BOM_BYTES[0] && buffer[1] === UTF16_BE_BOM_BYTES[1])
    ) {
      return true
    }
  }

  return false
}

/**
 * Check if buffer represents text content.
 *
 * @param buffer - Buffer to check
 * @returns True if the buffer appears to be text
 *
 * @example Checking if content is text
 * ```typescript
 * const buffer = readFileSync('./unknown-file')
 * if (isTextFile(buffer)) {
 *   const content = buffer.toString('utf-8')
 * }
 * ```
 */
export function isTextFile(buffer: Buffer): boolean {
  return detectEncodingInfo(buffer).type === 'text'
}

/**
 * Check if buffer represents binary content.
 *
 * @param buffer - Buffer to check
 * @returns True if the buffer appears to be binary
 *
 * @example Checking if content is binary
 * ```typescript
 * const buffer = readFileSync('./file.png')
 * if (isBinaryFile(buffer)) {
 *   // Handle as binary, not text
 * }
 * ```
 */
export function isBinaryFile(buffer: Buffer): boolean {
  return detectEncodingInfo(buffer).type === 'binary'
}
