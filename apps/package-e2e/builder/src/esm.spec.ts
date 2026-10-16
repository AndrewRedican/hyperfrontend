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

  it('resolves the /presets subpath export with byNames and byPrefix functions', async () => {
    const { byNames, byPrefix } = await import('@hyperfrontend/builder/presets')
    expect({ byNames, byPrefix }).toEqual({ byNames: expect.any(Function), byPrefix: expect.any(Function) })
  })

  it('builds a byNames predicate from the /presets subpath that accepts a listed name', async () => {
    const { byNames } = await import('@hyperfrontend/builder/presets')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('internal-utils')).toBe(true)
  })

  it('builds a byNames predicate from the /presets subpath that rejects an unlisted name', async () => {
    const { byNames } = await import('@hyperfrontend/builder/presets')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('rollup')).toBe(false)
  })

  it('builds a byPrefix predicate from the /presets subpath that accepts a name under the prefix', async () => {
    const { byPrefix } = await import('@hyperfrontend/builder/presets')
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('@hyperfrontend/logging')).toBe(true)
  })

  it('builds a byPrefix predicate from the /presets subpath that rejects a name outside the prefix', async () => {
    const { byPrefix } = await import('@hyperfrontend/builder/presets')
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('rollup')).toBe(false)
  })
})
