import { isMobileDevice } from './is-mobile-device'

describe('isMobileDevice', () => {
  const originalUserAgent = navigator.userAgent

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    })
  })

  it('returns true for Android device', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      writable: true,
      configurable: true,
    })
    expect(isMobileDevice()).toBe(true)
  })

  it('returns true for iPhone device', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      writable: true,
      configurable: true,
    })
    expect(isMobileDevice()).toBe(true)
  })

  it('returns true for iPad device', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      writable: true,
      configurable: true,
    })
    expect(isMobileDevice()).toBe(true)
  })

  it('returns false for desktop device', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true,
      configurable: true,
    })
    expect(isMobileDevice()).toBe(false)
  })

  it('returns false for Mac device', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      writable: true,
      configurable: true,
    })
    expect(isMobileDevice()).toBe(false)
  })
})
