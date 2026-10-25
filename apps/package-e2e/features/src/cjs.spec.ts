/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/features`
 * Tests that the package is requireable under plain Node (no window) and that
 * every documented exports subpath resolves with its expected symbol.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/features'
const E2E_DIR = join(__dirname, '..')
// why: the features tarball carries the bundled builder toolchain and installs typescript beside it.
const SETUP_TIMEOUT = 300_000
const RUNNER = [
  "'use strict'",
  "const { DisplayMode, defineConfig, sdkInfo, validateContract } = require('@hyperfrontend/features')",
  'async function main() {',
  "  const config = defineConfig({ name: 'clock', version: '1.0.0', contract: './clock.contract.json' })",
  '  const contract = validateContract({',
  "    emitted: [{ type: 'tick', description: 'Time snapshot.' }],",
  "    accepted: [{ type: 'ping', description: 'Liveness probe.' }],",
  '  })',
  "  let invalid = 'accepted'",
  '  try {',
  "    validateContract({ emitted: 'nope' })",
  '  } catch {',
  "    invalid = 'rejected'",
  '  }',
  '  return {',
  '    config,',
  '    emitted: contract.emitted.map((action) => action.type),',
  '    invalid,',
  '    packageName: sdkInfo.packageName,',
  '    embedded: DisplayMode.Embedded,',
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

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
      expect(mod).toEqual(expect.objectContaining({ default: expect.any(Function), [symbol]: mod['default'] }))
    })
  })
})

describe('@hyperfrontend/features CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.cjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('types a feature config, validates a contract and names the SDK', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      config: {
        name: 'clock',
        version: '1.0.0',
        contract: './clock.contract.json',
      },
      emitted: ['tick'],
      invalid: 'rejected',
      packageName: '@hyperfrontend/features',
      embedded: 'embedded',
    })
  })
})
