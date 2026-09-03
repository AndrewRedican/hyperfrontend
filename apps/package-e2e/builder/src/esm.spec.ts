/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/builder`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, expect, it } from '@hyperfrontend/testing'

describe('@hyperfrontend/builder ESM', () => {
  it('is importable', async () => {
    const pkg = await import('@hyperfrontend/builder')
    expect(pkg).toBeDefined()
  })

  it('exposes the documented public API', async () => {
    const pkg = await import('@hyperfrontend/builder')
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
    ] as const
    for (const name of expected) {
      expect(typeof pkg[name]).toBe('function')
    }
  })

  it('resolves the /presets subpath export with working predicates', async () => {
    const { byNames, byPrefix } = await import('@hyperfrontend/builder/presets')
    expect(typeof byNames).toBe('function')
    expect(typeof byPrefix).toBe('function')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('internal-utils')).toBe(true)
    expect(isNamed('rollup')).toBe(false)
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('@hyperfrontend/logging')).toBe(true)
    expect(isScoped('rollup')).toBe(false)
  })
})
