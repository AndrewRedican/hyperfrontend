import { tryLoadDevkit, isDevkitAvailable, getDevkit, withDevkit, resetDevkitCache } from './devkit-loader'

describe('Devkit Loader', () => {
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
      const result1 = tryLoadDevkit()
      expect(result1).toHaveProperty('available')

      const result2 = tryLoadDevkit()
      expect(result1).toBe(result2)

      const result3 = tryLoadDevkit()
      expect(result3).toBe(result1)
    })

    it('returns devkit when available or error when not', () => {
      const result = tryLoadDevkit()
      const hasDevkitOrError = result.devkit !== undefined || result.error !== undefined
      expect(hasDevkitOrError).toBe(true)
    })

    it('has devkit or error defined based on availability status', () => {
      const result = tryLoadDevkit()

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

      const totalCalls = ifAvailableFn.mock.calls.length + fallbackFn.mock.calls.length
      expect(totalCalls).toBe(1)

      const expectedResult = ifAvailableFn.mock.calls.length > 0 ? 'devkit-result' : 'fallback-result'
      expect(result).toBe(expectedResult)
    })

    it('calls ifAvailable when devkit is present, fallback otherwise', () => {
      const isAvailable = isDevkitAvailable()
      const ifAvailableFn = jest.fn(() => 'devkit')
      const fallbackFn = jest.fn(() => 'fallback')

      withDevkit(ifAvailableFn, fallbackFn)

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

      expect(result).toBe('ifAvailable-result')
      expect(receivedDevkit).toBeDefined()
      expect(ifAvailableFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('resetDevkitCache', () => {
    it('resets the cached result', () => {
      const result1 = tryLoadDevkit()

      resetDevkitCache()

      const result2 = tryLoadDevkit()

      expect(result1.available).toBe(result2.available)
    })
  })
})

describe('Devkit Loader - Available Scenario', () => {
  beforeEach(() => {
    resetDevkitCache()
  })

  it('loads @nx/devkit successfully', () => {
    const result = tryLoadDevkit()

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

describe('Devkit Loader - Caching Behavior', () => {
  it('returns cached result on second call without reset', () => {
    resetDevkitCache()

    const result1 = tryLoadDevkit()
    expect(result1.available).toBe(true)

    const result2 = tryLoadDevkit()
    expect(result2).toBe(result1)

    const result3 = tryLoadDevkit()
    expect(result3).toBe(result1)

    resetDevkitCache()
    const result4 = tryLoadDevkit()
    expect(result4).not.toBe(result1)
    expect(result4.available).toBe(result1.available)
  })
})
