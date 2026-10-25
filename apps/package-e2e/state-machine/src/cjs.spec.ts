/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/state-machine`
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: state-machine uses multiple sub-entry exports, not a single main entry.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/state-machine'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { fail, start, success } = require('@hyperfrontend/state-machine/actions')",
  "const { rootReducer } = require('@hyperfrontend/state-machine/reducer')",
  "const { derivedState } = require('@hyperfrontend/state-machine/selectors')",
  "const { createInitialState } = require('@hyperfrontend/state-machine/state')",
  "const { Store } = require('@hyperfrontend/state-machine/store')",
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
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/state-machine CJS', () => {
  describe('actions sub-entry', () => {
    it('is requireable', () => {
      const actions = require('@hyperfrontend/state-machine/actions')
      expect(actions).toBeDefined()
    })

    it('exports action creators', () => {
      const { start, cancel, pause, success, fail } = require('@hyperfrontend/state-machine/actions')
      expect({ start, cancel, pause, success, fail }).toEqual({
        start: expect.any(Function),
        cancel: expect.any(Function),
        pause: expect.any(Function),
        success: expect.any(Function),
        fail: expect.any(Function),
      })
    })

    it('creates a start action with a type', () => {
      const { start } = require('@hyperfrontend/state-machine/actions')

      const startAction = start()
      expect(startAction).toHaveProperty('type')
    })

    it('creates a success action with a type and a payload', () => {
      const { success } = require('@hyperfrontend/state-machine/actions')

      const successAction = success({ data: 'test' })
      expect(successAction).toEqual(expect.objectContaining({ type: expect.anything(), payload: expect.anything() }))
    })
  })

  describe('store sub-entry', () => {
    it('is requireable', () => {
      const store = require('@hyperfrontend/state-machine/store')
      expect(store).toBeDefined()
    })

    it('exposes the Store class', () => {
      const { Store } = require('@hyperfrontend/state-machine/store')
      expect(typeof Store).toBe('function')
    })
  })

  describe('reducer sub-entry', () => {
    it('is requireable', () => {
      const reducer = require('@hyperfrontend/state-machine/reducer')
      expect(reducer).toBeDefined()
    })
  })

  describe('selectors sub-entry', () => {
    it('is requireable', () => {
      const selectors = require('@hyperfrontend/state-machine/selectors')
      expect(selectors).toBeDefined()
    })
  })

  describe('state sub-entry', () => {
    it('is requireable', () => {
      const state = require('@hyperfrontend/state-machine/state')
      expect(state).toBeDefined()
    })
  })

  describe('async-operation sub-entry', () => {
    it('is requireable', () => {
      const asyncOp = require('@hyperfrontend/state-machine/async-operation')
      expect(asyncOp).toBeDefined()
    })
  })

  describe('events sub-entry', () => {
    it('is requireable', () => {
      const events = require('@hyperfrontend/state-machine/events')
      expect(events).toBeDefined()
    })
  })

  describe('models sub-entry', () => {
    it('is requireable', () => {
      const models = require('@hyperfrontend/state-machine/models')
      expect(models).toBeDefined()
    })
  })
})

describe('@hyperfrontend/state-machine CJS under plain Node in an isolated consumer', () => {
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

  it('derives the lifecycle names from a store fed start, fail and success', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
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
