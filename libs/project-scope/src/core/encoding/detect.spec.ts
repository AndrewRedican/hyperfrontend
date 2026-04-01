import {
  detectEncoding,
  detectEncodingInfo,
  hasBom,
  isTextFile,
  isBinaryFile,
  UTF8_BOM_BYTES,
  UTF16_LE_BOM_BYTES,
  UTF16_BE_BOM_BYTES,
} from './detect'

describe('core/encoding/detect', () => {
  describe('detectEncoding', () => {
    it('detects UTF-8 BOM', () => {
      const buffer = Buffer.from([...UTF8_BOM_BYTES, 0x68, 0x69])
      expect(detectEncoding(buffer)).toBe('utf-8')
    })

    it('detects UTF-16 LE BOM', () => {
      const buffer = Buffer.from([...UTF16_LE_BOM_BYTES, 0x00, 0x00])
      expect(detectEncoding(buffer)).toBe('utf16le')
    })

    it('detects UTF-16 BE BOM', () => {
      const buffer = Buffer.from([...UTF16_BE_BOM_BYTES, 0x00, 0x00])
      expect(detectEncoding(buffer)).toBe('utf16le')
    })

    it('defaults to UTF-8 for no BOM', () => {
      const buffer = Buffer.from('hello world', 'utf-8')
      expect(detectEncoding(buffer)).toBe('utf-8')
    })
  })

  describe('detectEncodingInfo', () => {
    it('detects text file with UTF-8 BOM', () => {
      const buffer = Buffer.from([...UTF8_BOM_BYTES, 0x68, 0x69])
      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('text')
      expect(info).toHaveProperty('encoding', 'utf-8')
      expect(info).toHaveProperty('hasBom', true)
    })

    it('detects text file without BOM', () => {
      const buffer = Buffer.from('hello world', 'utf-8')
      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('text')
      expect(info).toHaveProperty('hasBom', false)
    })

    it('detects PNG binary', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('binary')
      expect(info).toHaveProperty('format', 'PNG')
    })

    it('detects binary by null bytes', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x00, 0x03, 0x04])
      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('binary')
    })
  })

  describe('hasBom', () => {
    it('returns true for UTF-8 BOM', () => {
      const buffer = Buffer.from([...UTF8_BOM_BYTES, 0x68])
      expect(hasBom(buffer)).toBe(true)
    })

    it('returns false for no BOM', () => {
      const buffer = Buffer.from('hello', 'utf-8')
      expect(hasBom(buffer)).toBe(false)
    })
  })

  describe('isTextFile', () => {
    it('returns true for text content', () => {
      const buffer = Buffer.from('Hello, World!', 'utf-8')
      expect(isTextFile(buffer)).toBe(true)
    })

    it('returns false for binary content', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])
      expect(isTextFile(buffer)).toBe(false)
    })
  })

  describe('isBinaryFile', () => {
    it('returns true for binary content', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])
      expect(isBinaryFile(buffer)).toBe(true)
    })

    it('returns false for text content', () => {
      const buffer = Buffer.from('Hello, World!', 'utf-8')
      expect(isBinaryFile(buffer)).toBe(false)
    })
  })

  describe('detectEncodingInfo - UTF-16 BOM paths', () => {
    it('detects UTF-16 BE BOM with correct encoding', () => {
      const buffer = Buffer.from([...UTF16_BE_BOM_BYTES, 0x00, 0x48, 0x00, 0x69])
      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('text')
      expect(info).toHaveProperty('encoding', 'utf16le')
      expect(info).toHaveProperty('hasBom', true)
    })

    it('detects UTF-16 LE BOM with correct encoding', () => {
      const buffer = Buffer.from([...UTF16_LE_BOM_BYTES, 0x48, 0x00, 0x69, 0x00])
      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('text')
      expect(info).toHaveProperty('encoding', 'utf16le')
      expect(info).toHaveProperty('hasBom', true)
    })
  })

  describe('detectEncodingInfo - null byte detection', () => {
    it('detects binary by null byte in middle of content', () => {
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x00, 0x6f])
      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('binary')
    })

    it('samples only first 8000 bytes for null byte check', () => {
      const before = Buffer.alloc(7999, 0x41)
      const nullByte = Buffer.from([0x00])
      const after = Buffer.alloc(1000, 0x42)
      const buffer = Buffer.concat([before, nullByte, after])

      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('binary')
    })

    it('does not detect null bytes beyond sample size', () => {
      const before = Buffer.alloc(8001, 0x41)
      const after = Buffer.from([0x00])
      const buffer = Buffer.concat([before, after])

      const info = detectEncodingInfo(buffer)
      expect(info.type).toBe('text')
    })
  })

  describe('hasBom - UTF-16 cases', () => {
    it('returns true for UTF-16 LE BOM', () => {
      const buffer = Buffer.from([...UTF16_LE_BOM_BYTES, 0x00, 0x00])
      expect(hasBom(buffer)).toBe(true)
    })

    it('returns true for UTF-16 BE BOM', () => {
      const buffer = Buffer.from([...UTF16_BE_BOM_BYTES, 0x00, 0x00])
      expect(hasBom(buffer)).toBe(true)
    })

    it('returns false for buffer too short for UTF-16 check (1 byte)', () => {
      const buffer = Buffer.from([0x41])
      expect(hasBom(buffer)).toBe(false)
    })

    it('returns false for buffer too short for UTF-8 check (2 bytes)', () => {
      const buffer = Buffer.from([0x41, 0x42])
      expect(hasBom(buffer)).toBe(false)
    })
  })

  describe('detectEncoding - edge cases', () => {
    it('handles empty buffer', () => {
      const buffer = Buffer.from([])
      expect(detectEncoding(buffer)).toBe('utf-8')
    })

    it('handles single byte buffer', () => {
      const buffer = Buffer.from([0x41])
      expect(detectEncoding(buffer)).toBe('utf-8')
    })

    it('handles two byte buffer', () => {
      const buffer = Buffer.from([0x41, 0x42])
      expect(detectEncoding(buffer)).toBe('utf-8')
    })
  })
})
