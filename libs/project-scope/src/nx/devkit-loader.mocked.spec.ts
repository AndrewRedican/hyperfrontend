// Create a mock that throws on @nx/devkit
jest.mock('@nx/devkit', () => {
  throw new Error('Cannot find module @nx/devkit')
})

// We need to re-import after mocking
const { tryLoadDevkit, isDevkitAvailable, getDevkit, withDevkit, resetDevkitCache } = require('./devkit-loader')

describe('Devkit Loader - Unavailable Scenario (mocked)', () => {
  beforeEach(() => {
    // Reset the cache before each test
    resetDevkitCache()
  })

  describe('tryLoadDevkit when @nx/devkit is unavailable', () => {
    it('returns available: false', () => {
      const result = tryLoadDevkit()
      expect(result.available).toBe(false)
    })

    it('returns an error object', () => {
      const result = tryLoadDevkit()
      expect(result.error).toBeDefined()
      expect(result.error).toBeInstanceOf(Error)
    })

    it('does not return devkit module', () => {
      const result = tryLoadDevkit()
      expect(result.devkit).toBeUndefined()
    })

    it('caches unavailable result', () => {
      const result1 = tryLoadDevkit()
      const result2 = tryLoadDevkit()
      expect(result1).toBe(result2) // Same reference (cached)
      expect(result1.available).toBe(false)
    })
  })

  describe('isDevkitAvailable when @nx/devkit is unavailable', () => {
    it('returns false', () => {
      expect(isDevkitAvailable()).toBe(false)
    })
  })

  describe('getDevkit when @nx/devkit is unavailable', () => {
    it('throws an error', () => {
      expect(() => getDevkit()).toThrow('@nx/devkit is not available')
    })

    it('throws with helpful message', () => {
      expect(() => getDevkit()).toThrow('Install it as a dependency or use standalone mode')
    })
  })

  describe('withDevkit when @nx/devkit is unavailable', () => {
    it('executes fallback function', () => {
      const ifAvailableFn = jest.fn(() => 'devkit-result')
      const fallbackFn = jest.fn(() => 'fallback-result')

      const result = withDevkit(ifAvailableFn, fallbackFn)

      expect(result).toBe('fallback-result')
      expect(fallbackFn).toHaveBeenCalledTimes(1)
      expect(ifAvailableFn).not.toHaveBeenCalled()
    })

    it('returns fallback result', () => {
      const result = withDevkit(
        () => 'ifAvailable',
        () => 'fallback'
      )
      expect(result).toBe('fallback')
    })

    it('does not call ifAvailable callback', () => {
      const ifAvailableFn = jest.fn()
      const fallbackFn = jest.fn()

      withDevkit(ifAvailableFn, fallbackFn)

      expect(ifAvailableFn).not.toHaveBeenCalled()
    })
  })
})
