import { describe, expect, it } from '@hyperfrontend/testing'
import { base64ToUrlSafeBase64 } from './base64-to-url-safe-base64'

describe('base64ToUrlSafeBase64', () => {
  it.each([
    ['aGVsbG8=', true],
    ['8J+RiPCfjIE=', false],
  ])(
    `returns input %s unchanged when urlSafe = false and keepPadding = %s (keeps padding as-is)`,
    (base64: string, keepPadding: boolean) => {
      expect(base64ToUrlSafeBase64(base64, { urlSafe: false, keepPadding })).toBe(base64)
    }
  )

  it(`converts to url-safe and keeps padding when keepPadding = true`, () => {
    expect(
      base64ToUrlSafeBase64('8J+RiPCfjIE=', {
        urlSafe: true,
        keepPadding: true,
      })
    ).toBe('8J-RiPCfjIE=')
  })

  it(`converts to url-safe and removes padding when keepPadding = false`, () => {
    expect(
      base64ToUrlSafeBase64('8J+RiPCfjIE=', {
        urlSafe: true,
        keepPadding: false,
      })
    ).toBe('8J-RiPCfjIE')
  })
})
