/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/features`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * window and no loader hooks, so every documented exports subpath resolves and exposes its symbol the way a server-side
 * consumer's `require` sees it.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

/** Which symbol each documented subpath exposes, kept as runtime strings so the installed exports map resolves them. */
const NAMED_SUBPATH_SYMBOLS = [
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
const DEFAULT_EXPORT_SUBPATHS = [
  ['@hyperfrontend/features/nx/generators/feature', 'featureGenerator'],
  ['@hyperfrontend/features/nx/generators/init', 'initGenerator'],
  ['@hyperfrontend/features/nx/executors/build', 'runBuildExecutor'],
  ['@hyperfrontend/features/nx/executors/serve', 'serveExecutor'],
]

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/features CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('loads under plain Node with no window global', () => {
    const globals = consumer.run(
      async () => {
        require('@hyperfrontend/features')
        return typeof window
      },
      { kind: 'require' }
    )
    expect(globals).toBe('undefined')
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/features')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        defineConfig: 'function',
        defineDevConfig: 'function',
        validateContract: 'function',
        validateFeatureConfig: 'function',
        validatePayload: 'function',
        sdkInfo: 'object',
        DisplayMode: 'object',
      })
    )
  })

  describe('server-side require of every exports subpath', () => {
    it.each(NAMED_SUBPATH_SYMBOLS)('requires %s without a window and exposes %s', (specifier, symbol) => {
      const kind = consumer.run((probe) => typeof require(probe.specifier)[probe.symbol], { kind: 'require', args: { specifier, symbol } })
      expect(kind).toBe('function')
    })

    it.each(DEFAULT_EXPORT_SUBPATHS)('requires %s without a window and yields a callable default aliased as %s', (specifier, symbol) => {
      const aliased = consumer.run(
        (probe) => {
          const entry = require(probe.specifier)
          return typeof entry.default === 'function' && entry[probe.symbol] === entry.default
        },
        { kind: 'require', args: { specifier, symbol } }
      )
      expect(aliased).toBe(true)
    })
  })

  it('validates a well-formed contract and returns it', () => {
    const emitted = consumer.run(
      async () => {
        const { validateContract } = require('@hyperfrontend/features')
        const contract = validateContract({
          emitted: [{ type: 'tick', description: 'Time snapshot.' }],
          accepted: [{ type: 'ping', description: 'Liveness probe.' }],
        })
        return contract.emitted.map((action) => action.type)
      },
      { kind: 'require' }
    )
    expect(emitted).toEqual(['tick'])
  })

  it('names the published package in sdkInfo', () => {
    const name = consumer.run(() => require('@hyperfrontend/features').sdkInfo.packageName, { kind: 'require' })
    expect(name).toBe('@hyperfrontend/features')
  })
})
