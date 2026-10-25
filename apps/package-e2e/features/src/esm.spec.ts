/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/features`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * window and no loader hooks, so every documented exports subpath resolves and exposes its symbol the way a server-side
 * consumer's `import` sees it.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

/** Which symbol each documented subpath exposes, kept as runtime strings so the installed exports map resolves them. */
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

/** The specifier and symbol one subpath probe loads. */
interface SubpathProbe {
  /** The exports subpath as a consumer writes it. */
  specifier: string
  /** The symbol the subpath is documented to expose. */
  symbol: string
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/features ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('loads under plain Node with no window global', () => {
    const globals = consumer.run(async () => {
      await import('@hyperfrontend/features')
      return typeof window
    })
    expect(globals).toBe('undefined')
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/features')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
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

  describe('server-side import of every exports subpath', () => {
    it.each(SUBPATH_SYMBOLS)('imports %s without a window and exposes %s', (specifier, symbol) => {
      const kind = consumer.run(
        async (probe: SubpathProbe) => {
          const entry = (await import(probe.specifier)) as Record<string, unknown>
          return typeof entry[probe.symbol]
        },
        { args: { specifier, symbol } }
      )
      expect(kind).toBe('function')
    })
  })

  it('returns a feature config unchanged through defineConfig', () => {
    const config = consumer.run(async () => {
      const { defineConfig } = await import('@hyperfrontend/features')
      return defineConfig({ name: 'clock', version: '1.0.0', contract: './clock.contract.json' })
    })
    expect(config).toEqual({ name: 'clock', version: '1.0.0', contract: './clock.contract.json' })
  })

  it('validates a well-formed contract and returns it', () => {
    const emitted = consumer.run(async () => {
      const { validateContract } = await import('@hyperfrontend/features')
      const contract = validateContract({
        emitted: [{ type: 'tick', description: 'Time snapshot.' }],
        accepted: [{ type: 'ping', description: 'Liveness probe.' }],
      })
      return contract.emitted.map((action) => action.type)
    })
    expect(emitted).toEqual(['tick'])
  })

  it('rejects a malformed contract', () => {
    const outcome = consumer.run(async () => {
      const { validateContract } = await import('@hyperfrontend/features')
      try {
        validateContract({ emitted: 'nope' })
        return 'accepted'
      } catch {
        return 'rejected'
      }
    })
    expect(outcome).toBe('rejected')
  })

  it('names the published package in sdkInfo and the embedded display mode', () => {
    const names = consumer.run(async () => {
      const { DisplayMode, sdkInfo } = await import('@hyperfrontend/features')
      return [sdkInfo.packageName, DisplayMode.Embedded]
    })
    expect(names).toEqual(['@hyperfrontend/features', 'embedded'])
  })
})
