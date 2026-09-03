import { describe, expect, it } from '@hyperfrontend/testing'
import { urlSafeBase64ToBase64 } from './url-safe-base64-to-base64'

describe('normalizeBase64UrlToBase64', () => {
  it(`adds 1 "=" when length % 4 === 3, (e.g. "hello" url-safe without padding)`, () => {
    expect(urlSafeBase64ToBase64('aGVsbG8')).toBe('aGVsbG8=')
  })

  it(`adds 2 "=" when length % 4 === 2, (e.g. "M" without padding)`, () => {
    expect(urlSafeBase64ToBase64('TQ')).toBe('TQ==')
  })

  it(`converts url-safe alphabet and pads if needed (handles "-" and "-")`, () => {
    expect(urlSafeBase64ToBase64('8J-RiPCfjIE')).toBe('8J+RiPCfjIE=')
  })

  it(`returns input unchanges when already standard and length % 4 === 0`, () => {
    expect(urlSafeBase64ToBase64('YW55')).toBe('YW55')
  })
})
