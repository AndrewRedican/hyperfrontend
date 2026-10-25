/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/features`
 * Tests that the package is importable under plain Node (no window) and that
 * every documented exports subpath resolves with its expected symbol.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/features'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the features tarball carries the bundled builder toolchain and installs typescript beside it.
const SETUP_TIMEOUT = 300_000
const RUNNER = [
  "import { DisplayMode, defineConfig, sdkInfo, validateContract } from '@hyperfrontend/features'",
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
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

// note: Subpath specifiers are kept in runtime strings so resolution is exercised against the installed tarball, not the compiler's view of it.
const SUBPATH_SYMBOLS: ReadonlyArray<readonly [string, string]> = [
  ['@hyperfrontend/features', 'defineConfig'],
  ['@hyperfrontend/features/host', 'createShell'],
  ['@hyperfrontend/features/hostee', 'createFeature'],
  ['@hyperfrontend/features/cli', 'runFeaturesCli'],
  ['@hyperfrontend/features/server', 'startDevServer'],
  ['@hyperfrontend/features/generators', 'generateShell'],
  ['@hyperfrontend/features/nx/generators', 'initGenerator'],
  ['@hyperfrontend/features/nx/executors', 'runBuildExecutor'],
  ['@hyperfrontend/features/nx/generators/feature', 'default'],
  ['@hyperfrontend/features/nx/generators/init', 'default'],
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
      const mod = (await import(specifier)) as Record<string, unknown>
      expect(typeof mod[symbol]).toBe('function')
    })
  })
})

describe('@hyperfrontend/features ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.mjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('types a feature config, validates a contract and names the SDK', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
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
