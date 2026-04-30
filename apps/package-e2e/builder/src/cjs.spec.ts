/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/builder
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/builder CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder')
    expect(pkg).toBeDefined()
  })

  it('should expose the documented public API', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/builder')
    const expected = [
      'build',
      'createBuildContext',
      'runBinPhase',
      'runBundlePhase',
      'runPackagePhase',
      'createMemoryMonitor',
      'recover',
      'byNames',
      'byPrefix',
    ]
    for (const name of expected) {
      expect(typeof pkg[name]).toBe('function')
    }
  })

  it('should expose preset factories that produce working predicates', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { byNames, byPrefix } = require('@hyperfrontend/builder')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('internal-utils')).toBe(true)
    expect(isNamed('rollup')).toBe(false)
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('@hyperfrontend/logging')).toBe(true)
    expect(isScoped('rollup')).toBe(false)
  })
})
