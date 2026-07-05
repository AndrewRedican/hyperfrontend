/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/features
 * Tests that the package is importable under plain Node (no window) and that
 * every documented exports subpath resolves with its expected symbol.
 */

// note: Subpath specifiers are kept in runtime strings so resolution is exercised against the installed tarball, not the compiler's view of it.
const SUBPATH_SYMBOLS: ReadonlyArray<readonly [string, string]> = [
  ['@hyperfrontend/features', 'defineConfig'],
  ['@hyperfrontend/features/host', 'createShell'],
  ['@hyperfrontend/features/hostee', 'createFeature'],
  ['@hyperfrontend/features/cli', 'runFeaturesCli'],
  ['@hyperfrontend/features/server', 'startDevServer'],
  ['@hyperfrontend/features/generators', 'generateShell'],
  ['@hyperfrontend/features/nx/generators/feature', 'default'],
  ['@hyperfrontend/features/nx/executors/build', 'default'],
  ['@hyperfrontend/features/nx/executors/serve', 'default'],
]

describe('@hyperfrontend/features ESM', () => {
  it('runs under plain Node with no window global', () => {
    expect(typeof window).toBe('undefined')
  })

  it('is importable', async () => {
    const pkg = await import('@hyperfrontend/features')
    expect(pkg).toBeDefined()
  })

  it('has exports', async () => {
    const pkg = await import('@hyperfrontend/features')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  describe('server-side import of every exports subpath', () => {
    it.each(SUBPATH_SYMBOLS)('imports %s without a window and exposes %s', async (specifier, symbol) => {
      const mod = <Record<string, unknown>>await import(specifier)
      expect(typeof mod[symbol]).toBe('function')
    })
  })
})
