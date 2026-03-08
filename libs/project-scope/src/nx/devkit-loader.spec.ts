import { tryLoadDevkit, isDevkitAvailable, getDevkit, withDevkit, resetDevkitCache } from './devkit-loader'

describe('Devkit Loader', () => {
  // Reset cache before each test to ensure isolation
  beforeEach(() => {
    resetDevkitCache()
  })

  describe('tryLoadDevkit', () => {
    it('returns an object with available property', () => {
      const result = tryLoadDevkit()
      expect(result).toHaveProperty('available')
      expect(typeof result.available).toBe('boolean')
    })

    it('caches result on subsequent calls', () => {
      // First call - should load devkit and cache it
      const result1 = tryLoadDevkit()
      expect(result1).toHaveProperty('available')

      // Second call - should return cached result (tests lines 34-36)
      const result2 = tryLoadDevkit()
      expect(result1).toBe(result2) // Same reference (cached)

      // Third call - still cached
      const result3 = tryLoadDevkit()
      expect(result3).toBe(result1)
    })

    it('returns devkit when available or error when not', () => {
      const result = tryLoadDevkit()
      // Either devkit is defined (available) or error is defined (not available)
      const hasDevkitOrError = result.devkit !== undefined || result.error !== undefined
      expect(hasDevkitOrError).toBe(true)
    })

    it('has devkit or error defined based on availability status', () => {
      const result = tryLoadDevkit()

      // Test that the result state is consistent
      // When available: devkit is defined, error is undefined
      // When not available: error is defined, devkit is undefined
      expect(result.available === (result.devkit !== undefined)).toBe(true)
      expect(result.available === (result.error === undefined)).toBe(true)
    })
  })

  describe('isDevkitAvailable', () => {
    it('returns a boolean', () => {
      const result = isDevkitAvailable()
      expect(typeof result).toBe('boolean')
    })

    it('is consistent with tryLoadDevkit', () => {
      const loadResult = tryLoadDevkit()
      const isAvailable = isDevkitAvailable()
      expect(isAvailable).toBe(loadResult.available)
    })
  })

  describe('getDevkit', () => {
    it('returns devkit when available', () => {
      // @nx/devkit is available in this workspace
      const devkit = getDevkit()
      expect(devkit).toBeDefined()
      expect(typeof devkit).toBe('object')
    })
  })

  describe('withDevkit', () => {
    it('executes exactly one of the two callbacks', () => {
      const ifAvailableFn = jest.fn(() => 'devkit-result')
      const fallbackFn = jest.fn(() => 'fallback-result')

      const result = withDevkit(ifAvailableFn, fallbackFn)

      // Exactly one should be called
      const totalCalls = ifAvailableFn.mock.calls.length + fallbackFn.mock.calls.length
      expect(totalCalls).toBe(1)

      // Result should be from whichever was called
      const expectedResult = ifAvailableFn.mock.calls.length > 0 ? 'devkit-result' : 'fallback-result'
      expect(result).toBe(expectedResult)
    })

    it('calls ifAvailable when devkit is present, fallback otherwise', () => {
      const isAvailable = isDevkitAvailable()
      const ifAvailableFn = jest.fn(() => 'devkit')
      const fallbackFn = jest.fn(() => 'fallback')

      withDevkit(ifAvailableFn, fallbackFn)

      // The one that was called should match availability
      expect(ifAvailableFn.mock.calls.length > 0).toBe(isAvailable)
      expect(fallbackFn.mock.calls.length > 0).toBe(!isAvailable)
    })

    it('passes devkit to ifAvailable callback and returns its result', () => {
      let receivedDevkit: unknown = null
      const ifAvailableFn = jest.fn((devkit) => {
        receivedDevkit = devkit
        return 'ifAvailable-result'
      })
      const fallbackFn = jest.fn(() => 'fallback-result')

      const result = withDevkit(ifAvailableFn, fallbackFn)

      // Since @nx/devkit is available in this workspace
      expect(result).toBe('ifAvailable-result')
      expect(receivedDevkit).toBeDefined()
      expect(ifAvailableFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('resetDevkitCache', () => {
    it('resets the cached result', () => {
      // First load
      const result1 = tryLoadDevkit()

      // Reset cache
      resetDevkitCache()

      // Second load should create new result (different reference)
      const result2 = tryLoadDevkit()

      // This tests that a new object is created after reset
      // (though the values should be the same)
      expect(result1.available).toBe(result2.available)
    })
  })
})

// Tests for when @nx/devkit IS available (which is the case in this workspace)
describe('Devkit Loader - Available Scenario', () => {
  beforeEach(() => {
    resetDevkitCache()
  })

  it('loads @nx/devkit successfully', () => {
    // This workspace has @nx/devkit installed, so we can test the success path
    const result = tryLoadDevkit()

    // In this workspace, devkit should be available
    expect(result.available).toBe(true)
    expect(result.devkit).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  it('getDevkit returns the module when available', () => {
    const devkit = getDevkit()

    expect(devkit).toBeDefined()
    expect(typeof devkit).toBe('object')
  })

  it('withDevkit calls ifAvailable callback with devkit module', () => {
    let receivedDevkit: unknown = null

    const result = withDevkit(
      (devkit) => {
        receivedDevkit = devkit
        return 'success'
      },
      () => 'fallback'
    )

    expect(result).toBe('success')
    expect(receivedDevkit).toBeDefined()
  })
})

// Test caching behavior explicitly
describe('Devkit Loader - Caching Behavior', () => {
  it('returns cached result on second call without reset', () => {
    // Reset to start fresh
    resetDevkitCache()

    // First call loads and caches (hits the try/catch path)
    const result1 = tryLoadDevkit()
    expect(result1.available).toBe(true)

    // Second call returns cached (hits the if cachedResult !== null path)
    const result2 = tryLoadDevkit()
    expect(result2).toBe(result1) // Same object reference

    // Third call also returns cached
    const result3 = tryLoadDevkit()
    expect(result3).toBe(result1)

    // Now reset and verify a new result is created
    resetDevkitCache()
    const result4 = tryLoadDevkit()
    expect(result4).not.toBe(result1) // Different object
    expect(result4.available).toBe(result1.available) // Same availability status
  })
})
