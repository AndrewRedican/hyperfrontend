/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/features
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
]

// note: Default-only entries compile to `module.exports = fn` in CJS, so the required module itself is the callable.
const DEFAULT_EXPORT_SUBPATHS: readonly string[] = [
  '@hyperfrontend/features/nx/generators/feature',
  '@hyperfrontend/features/nx/executors/build',
  '@hyperfrontend/features/nx/executors/serve',
]

describe('@hyperfrontend/features CJS', () => {
  it('runs under plain Node with no window global', () => {
    expect(typeof window).toBe('undefined')
  })

  it('is requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/features')
    expect(pkg).toBeDefined()
  })

  it('has exports', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('@hyperfrontend/features')
    const exportedKeys = Object.keys(pkg)
    expect(exportedKeys.length).toBeGreaterThan(0)
  })

  describe('server-side require of every exports subpath', () => {
    it.each(NAMED_SUBPATH_SYMBOLS)('requires %s without a window and exposes %s', (specifier, symbol) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = <Record<string, unknown>>require(specifier)
      expect(typeof mod[symbol]).toBe('function')
    })

    it.each(DEFAULT_EXPORT_SUBPATHS)('requires %s without a window and yields a callable default', (specifier) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = <unknown>require(specifier)
      expect(typeof mod).toBe('function')
    })
  })
})
