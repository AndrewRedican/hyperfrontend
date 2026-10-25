/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/state-machine`
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: state-machine uses multiple sub-entry exports, not a single main entry.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/state-machine'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { fail, start, success } from '@hyperfrontend/state-machine/actions'",
  "import { rootReducer } from '@hyperfrontend/state-machine/reducer'",
  "import { derivedState } from '@hyperfrontend/state-machine/selectors'",
  "import { createInitialState } from '@hyperfrontend/state-machine/state'",
  "import { Store } from '@hyperfrontend/state-machine/store'",
  'async function main() {',
  "  const NAMES = ['notStarted', 'inProgress', 'done', 'successful', 'failed', 'retrying', 'restarting']",
  '  const store = new Store()',
  '  const phases = []',
  '  store.subscribe((state) => phases.push(NAMES.filter((name) => derivedState(state)[name])))',
  '  store.dispatch(start())',
  "  store.dispatch(fail(new Error('offline')))",
  '  store.dispatch(start())',
  '  store.dispatch(success())',
  '  store.dispatch(start())',
  '  return { phases, initial: createInitialState(), reduced: rootReducer(createInitialState(), start()).inProgress }',
  '}',
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/state-machine ESM', () => {
  describe('actions sub-entry', () => {
    it('is importable', async () => {
      const actions = await import('@hyperfrontend/state-machine/actions')
      expect(actions).toBeDefined()
    })

    it('exports action creators', async () => {
      const { start, cancel, pause, success, fail } = await import('@hyperfrontend/state-machine/actions')
      expect({ start, cancel, pause, success, fail }).toEqual({
        start: expect.any(Function),
        cancel: expect.any(Function),
        pause: expect.any(Function),
        success: expect.any(Function),
        fail: expect.any(Function),
      })
    })

    it('creates a start action with a type', async () => {
      const { start } = await import('@hyperfrontend/state-machine/actions')

      const startAction = start()
      expect(startAction).toHaveProperty('type')
    })

    it('creates a success action with a type and a payload', async () => {
      const { success } = await import('@hyperfrontend/state-machine/actions')

      const successAction = success({ data: 'test' })
      expect(successAction).toEqual(expect.objectContaining({ type: expect.anything(), payload: expect.anything() }))
    })
  })

  describe('store sub-entry', () => {
    it('is importable', async () => {
      const store = await import('@hyperfrontend/state-machine/store')
      expect(store).toBeDefined()
    })

    it('exposes the Store class', async () => {
      const { Store } = await import('@hyperfrontend/state-machine/store')
      expect(typeof Store).toBe('function')
    })
  })

  describe('reducer sub-entry', () => {
    it('is importable', async () => {
      const reducer = await import('@hyperfrontend/state-machine/reducer')
      expect(reducer).toBeDefined()
    })
  })

  describe('selectors sub-entry', () => {
    it('is importable', async () => {
      const selectors = await import('@hyperfrontend/state-machine/selectors')
      expect(selectors).toBeDefined()
    })
  })

  describe('state sub-entry', () => {
    it('is importable', async () => {
      const state = await import('@hyperfrontend/state-machine/state')
      expect(state).toBeDefined()
    })
  })

  describe('async-operation sub-entry', () => {
    it('is importable', async () => {
      const asyncOp = await import('@hyperfrontend/state-machine/async-operation')
      expect(asyncOp).toBeDefined()
    })
  })

  describe('events sub-entry', () => {
    it('is importable', async () => {
      const events = await import('@hyperfrontend/state-machine/events')
      expect(events).toBeDefined()
    })
  })

  describe('models sub-entry', () => {
    it('is importable', async () => {
      const models = await import('@hyperfrontend/state-machine/models')
      expect(models).toBeDefined()
    })
  })
})

describe('@hyperfrontend/state-machine ESM under plain Node in an isolated consumer', () => {
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

  it('derives the lifecycle names from a store fed start, fail and success', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      phases: [['inProgress'], ['done', 'failed'], ['inProgress', 'retrying'], ['done', 'successful'], ['inProgress', 'restarting']],
      initial: {
        inProgress: false,
        success: false,
        fail: false,
        halt: false,
      },
      reduced: true,
    })
  })
})
