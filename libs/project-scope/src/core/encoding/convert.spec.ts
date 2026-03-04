import { toUtf8, bufferToString, stripBom, addBom } from './convert'
import { UTF8_BOM, UTF8_BOM_BYTES } from './detect'

describe('core/encoding/convert', () => {
  describe('toUtf8', () => {
    it('returns string as-is', () => {
      expect(toUtf8('hello')).toBe('hello')
    })

    it('converts buffer to string', () => {
      const buffer = Buffer.from('hello', 'utf-8')
      expect(toUtf8(buffer)).toBe('hello')
    })
  })

  describe('bufferToString', () => {
    it('converts buffer with specified encoding', () => {
      const buffer = Buffer.from('hello', 'utf-8')
      expect(bufferToString(buffer, 'utf-8')).toBe('hello')
    })

    it('auto-detects encoding and strips BOM', () => {
      const buffer = Buffer.from([...UTF8_BOM_BYTES, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
      expect(bufferToString(buffer)).toBe('hello')
    })

    it('throws for binary content', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG
      expect(() => bufferToString(buffer)).toThrow(/Cannot convert binary/)
    })
  })

  describe('stripBom', () => {
    it('strips BOM from string', () => {
      expect(stripBom(UTF8_BOM + 'hello')).toBe('hello')
    })

    it('returns string unchanged if no BOM', () => {
      expect(stripBom('hello')).toBe('hello')
    })
  })

  describe('addBom', () => {
    it('adds BOM to string', () => {
      expect(addBom('hello')).toBe(UTF8_BOM + 'hello')
    })

    it('does not double-add BOM', () => {
      expect(addBom(UTF8_BOM + 'hello')).toBe(UTF8_BOM + 'hello')
    })
  })
})
