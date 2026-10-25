/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/nexus`
 * Tests that the package is importable under plain Node (no window) and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/nexus'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { DEFAULT_CONTRACT, byType, createBroker, mergeContracts } from '@hyperfrontend/nexus'",
  'async function main() {',
  "  let withoutWindow = 'created'",
  '  try {',
  "    createBroker({ name: 'host', contract: DEFAULT_CONTRACT })",
  '  } catch (error) {',
  '    withoutWindow = error.message',
  '  }',
  "  const merged = mergeContracts({ accepted: [{ type: 'A' }], emitted: [] }, { accepted: [{ type: 'A' }], emitted: [{ type: 'B' }] })",
  '  const seen = []',
  "  const onlyPing = byType('PING')((message) => seen.push(message.type))",
  "  onlyPing({ type: 'PING' })",
  "  onlyPing({ type: 'PONG' })",
  '  return {',
  '    withoutWindow,',
  '    merged: { accepted: merged.accepted.map((action) => action.type), emitted: merged.emitted.map((action) => action.type) },',
  '    seen,',
  '  }',
  '}',
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/nexus ESM', () => {
  it('runs under plain Node with no window global', () => {
    expect(typeof window).toBe('undefined')
  })

  it('is importable without a window', async () => {
    const nexus = await import('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('exports the createBroker function', async () => {
    const { createBroker } = await import('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
  })

  it('exports the createChannel function', async () => {
    const { createChannel } = await import('@hyperfrontend/nexus')
    expect(typeof createChannel).toBe('function')
  })

  it('exports the mergeContracts function', async () => {
    const { mergeContracts } = await import('@hyperfrontend/nexus')
    expect(typeof mergeContracts).toBe('function')
  })

  it('exports the defaultBroker singleton', async () => {
    const { defaultBroker } = await import('@hyperfrontend/nexus')
    expect(defaultBroker).toBeDefined()
  })

  it('exports DEFAULT_CONTRACT', async () => {
    const { DEFAULT_CONTRACT } = await import('@hyperfrontend/nexus')
    expect(DEFAULT_CONTRACT).toBeDefined()
  })
})

describe('@hyperfrontend/nexus ESM under plain Node in an isolated consumer', () => {
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

  it('merges contracts, filters messages by type and names the missing window', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      withoutWindow:
        'Cannot create broker: no window is available. Pass an explicit `window` in the broker config when running outside a browser environment.',
      merged: {
        accepted: ['A'],
        emitted: ['B'],
      },
      seen: ['PING'],
    })
  })
})
