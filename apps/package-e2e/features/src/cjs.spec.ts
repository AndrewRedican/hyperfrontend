/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/features`
 * Tests that the package is requireable under plain Node (no window) and that
 * every documented exports subpath resolves with its expected symbol.
 */

// note: Subpath specifiers are kept in runtime strings so resolution is exercised against the installed tarball, not the compiler's view of it.
const NAMED_SUBPATH_SYMBOLS: ReadonlyArray<readonly [string, string]> = [
  ['@hyperfrontend/features', 'defineConfig'],
  ['@hyperfrontend/features/host', 'createShell'],
  ['@hyperfrontend/features/hostee', 'createFeature'],
  ['@hyperfrontend/features/cli', 'runFeaturesCli'],
  ['@hyperfrontend/features/server', 'startDevServer'],
  ['@hyperfrontend/features/generators', 'generateShell'],
  ['@hyperfrontend/features/nx/generators', 'initGenerator'],
  ['@hyperfrontend/features/nx/executors', 'runBuildExecutor'],
]

// note: Nx plugin entries expose the callable as `default` (what Nx's factory/implementation loader consumes) and again under its own name for programmatic use.
const DEFAULT_EXPORT_SUBPATHS: ReadonlyArray<readonly [string, string]> = [
  ['@hyperfrontend/features/nx/generators/feature', 'featureGenerator'],
  ['@hyperfrontend/features/nx/generators/init', 'initGenerator'],
  ['@hyperfrontend/features/nx/executors/build', 'runBuildExecutor'],
  ['@hyperfrontend/features/nx/executors/serve', 'serveExecutor'],
]

describe('@hyperfrontend/features CJS', () => {
  it('runs under plain Node with no window global', () => {
    expect(typeof window).toBe('undefined')
  })

  it('is requireable', () => {
    const pkg = require('@hyperfrontend/features')
    expect(pkg).toBeDefined()
  })

  it('has exports', () => {
    const pkg = require('@hyperfrontend/features')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  describe('server-side require of every exports subpath', () => {
    it.each(NAMED_SUBPATH_SYMBOLS)('requires %s without a window and exposes %s', (specifier, symbol) => {
      const mod = require(specifier) as Record<string, unknown>
      expect(typeof mod[symbol]).toBe('function')
    })

    it.each(DEFAULT_EXPORT_SUBPATHS)('requires %s without a window and yields a callable default aliased as %s', (specifier, symbol) => {
      const mod = require(specifier) as Record<string, unknown>
      expect(typeof mod['default']).toBe('function')
      expect(mod[symbol]).toBe(mod['default'])
    })
  })
})
