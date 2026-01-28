import { base64ToUrlSafeBase64 } from './base64-to-url-safe-base64'

describe('base64ToUrlSafeBase64', () => {
  it(`returns input unchanges when urlSafe = false (keeps padding as-is)`, () => {
    expect(base64ToUrlSafeBase64('aGVsbG8=', { urlSafe: false, keepPadding: true })).toBe('aGVsbG8=')
    expect(
      base64ToUrlSafeBase64('8J+RiPCfjIE=', {
        urlSafe: false,
        keepPadding: false,
      })
    ).toBe('8J+RiPCfjIE=')
  })

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
