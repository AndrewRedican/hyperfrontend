import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createScopedLogger } from '../logger'
import { UTF8_BOM, detectEncodingInfo } from './detect'

const convertLogger = createScopedLogger('project-scope:encoding:convert')

/**
 * Convert content to UTF-8 string.
 *
 * @param content - Buffer or string content
 * @param sourceEncoding - Source encoding (auto-detected if not provided)
 * @returns UTF-8 string
 *
 * @example Converting a buffer to UTF-8 string
 * ```typescript
 * const buffer = Buffer.from('Hello', 'utf-8')
 * const text = toUtf8(buffer)
 * // => 'Hello'
 * ```
 */
export function toUtf8(content: Buffer | string, sourceEncoding: BufferEncoding = 'utf-8'): string {
  if (typeof content === 'string') {
    return content
  }
  return content.toString(sourceEncoding)
}

/**
 * Convert buffer to string with encoding detection.
 *
 * @param content - Buffer to convert
 * @param encoding - Optional encoding override (auto-detected if not provided)
 * @returns Converted string
 * @throws {Error} If content is binary and cannot be converted
 *
 * @example Converting file buffer to string with auto-detection
 * ```typescript
 * const fileBuffer = readFileSync('./config.json')
 * const content = bufferToString(fileBuffer)
 * // => '{"key": "value"}'
 * ```
 */
export function bufferToString(content: Buffer, encoding?: BufferEncoding): string {
  convertLogger.debug('Converting buffer to string', { bufferSize: content.length, providedEncoding: encoding })

  if (encoding) {
    convertLogger.debug('Using provided encoding', { encoding })
    return content.toString(encoding)
  }

  const info = detectEncodingInfo(content)
  if (info.type === 'text') {
    let offset = 0
    if (info.hasBom) {
      offset = info.encoding === 'utf-8' ? 3 : 2
      convertLogger.debug('Stripping BOM from buffer', { encoding: info.encoding, bomOffset: offset })
    }
    return content.subarray(offset).toString(info.encoding)
  }

  convertLogger.warn('Cannot convert binary content to string', { format: info.type === 'binary' ? info.format : undefined })
  throw createError('Cannot convert binary content to string')
}

/**
 * Strip BOM from start of string if present.
 *
 * @param content - String that may have BOM
 * @returns String without BOM
 *
 * @example Stripping BOM from a string
 * ```typescript
 * const withBom = '\ufeffHello World'
 * const clean = stripBom(withBom)
 * // => 'Hello World'
 * ```
 */
export function stripBom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1)
  }
  return content
}

/**
 * Add UTF-8 BOM to string if not present.
 *
 * @param content - String to add BOM to
 * @returns String with BOM
 *
 * @example Adding UTF-8 BOM to content
 * ```typescript
 * const content = 'Hello World'
 * const withBom = addBom(content)
 * // => '\ufeffHello World'
 * ```
 */
export function addBom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content
  }
  return UTF8_BOM + content
}
