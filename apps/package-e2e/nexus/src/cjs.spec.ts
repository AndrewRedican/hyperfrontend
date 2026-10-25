/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/nexus`
 * Tests that the package is requireable under plain Node (no window) and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/nexus'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { DEFAULT_CONTRACT, byType, createBroker, mergeContracts } = require('@hyperfrontend/nexus')",
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
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/nexus CJS', () => {
  it('runs under plain Node with no window global', () => {
    expect(typeof window).toBe('undefined')
  })

  it('is requireable without a window', () => {
    const nexus = require('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('exports the createBroker function', () => {
    const { createBroker } = require('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
  })

  it('exports the createChannel function', () => {
    const { createChannel } = require('@hyperfrontend/nexus')
    expect(typeof createChannel).toBe('function')
  })

  it('exports the mergeContracts function', () => {
    const { mergeContracts } = require('@hyperfrontend/nexus')
    expect(typeof mergeContracts).toBe('function')
  })

  it('exports the defaultBroker singleton', () => {
    const { defaultBroker } = require('@hyperfrontend/nexus')
    expect(defaultBroker).toBeDefined()
  })

  it('exports DEFAULT_CONTRACT', () => {
    const { DEFAULT_CONTRACT } = require('@hyperfrontend/nexus')
    expect(DEFAULT_CONTRACT).toBeDefined()
  })
})

describe('@hyperfrontend/nexus CJS under plain Node in an isolated consumer', () => {
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

  it('merges contracts, filters messages by type and names the missing window', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
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
