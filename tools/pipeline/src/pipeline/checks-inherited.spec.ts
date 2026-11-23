import type { CheckApi } from './checks'
import type { Chain, Origin, PlanTask, TaskResult } from './model'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { CheckRefusal, chainChecks } from './checks'
import { inheritedResults } from './report'

/** Where the inherited tasks of the fixture ran. */
const ORIGIN: Origin = { run: 7, attempt: 1, sha: 'abcdef0123456789', url: null, tree: '0123456789abcdef', node: 'v24.18.0', endedAt: 1000 }

/**
 * A chain every task of which keeps an earlier outcome.
 *
 * @param project - The project the chain is of
 * @returns The chain, of a type check and a test
 */
function chainOf(project: string): Chain {
  const task = (target: string): PlanTask => ({
    id: `${project}:${target}`,
    project,
    target,
    environment: 'linux',
    needs: [],
    weight: 'light',
    reasons: [],
    command: [],
    env: {},
    inherited: ORIGIN,
  })
  return { project, environment: 'linux', order: 0, tasks: [task('typecheck'), task('test')] }
}

/**
 * The results of a chain's tasks.
 *
 * @param chain - A chain inherited whole
 * @returns One inherited result per task
 */
function resultsOf(chain: Chain): TaskResult[] {
  return inheritedResults(chain.tasks)
}

/** An API whose publishes are answered only when the test settles them. */
interface Publishing {
  /** The API; every other request fails the test. */
  readonly api: CheckApi
  /** What was published, in order. */
  readonly sent: unknown[][]
  /** Settles the oldest publish not settled yet: answered, or failed with what is given. */
  settle(failure?: unknown): Promise<void>
}

/**
 * An API holding every publish until the test settles it.
 *
 * @returns The API, what it was sent and how to settle the oldest request
 */
function publishing(): Publishing {
  const sent: unknown[][] = []
  const held: ReturnType<typeof createDeferred<void>>[] = []
  const never = async (): Promise<never> => Promise.reject(new Error('only publish is expected'))
  return {
    sent,
    api: {
      create: never,
      update: never,
      complete: never,
      publish: (name, headSha, conclusion, output) => {
        const deferred = createDeferred<void>()
        sent.push([name, headSha, conclusion, output.title])
        held.push(deferred)
        return deferred.promise
      },
    },
    settle: async (failure) => {
      const deferred = held.shift()
      if (failure === undefined) deferred?.resolve()
      else deferred?.reject(failure)
      await flushPromises()
    },
  }
}

/**
 * Stands in for the rest between two check runs, so no spec waits a real second.
 *
 * @returns Resolves at once
 */
async function noWait(): Promise<void> {
  return undefined
}

describe('chainChecks onInherited', () => {
  it('creates the check run of a chain inherited whole already completed, titled by how many tasks it inherits and from which run', async () => {
    const { api, sent, settle } = publishing()
    const done = chainChecks(
      api,
      'abc',
      () => undefined,
      () => undefined,
      null,
      noWait
    ).onInherited(chainOf('lib-a'), resultsOf(chainOf('lib-a')))
    await flushPromises()
    await settle()
    await done
    expect(sent).toEqual([['lib-a (linux)', 'abc', 'success', '2 tasks inherited from run 7']])
  })

  it('shows every task of the chain as inherited', async () => {
    const summaries: string[] = []
    const { api } = publishing()
    const publish: CheckApi['publish'] = async (_name, _sha, _conclusion, output) => {
      summaries.push(output.summary)
    }
    await chainChecks(
      { ...api, publish },
      'abc',
      () => undefined,
      () => undefined,
      null,
      noWait
    ).onInherited(chainOf('lib-a'), resultsOf(chainOf('lib-a')))
    expect(summaries).toEqual([
      expect.stringContaining('| `lib-a:test` | ↩️ inherited |  | inherited from run 7 (abcdef0): nothing it reads changed since |'),
    ])
  })

  it('records no check run to settle, since none is left open', async () => {
    const seen: unknown[] = []
    const { api, settle } = publishing()
    const hooks = chainChecks(
      api,
      'abc',
      () => undefined,
      (records) => seen.push(records),
      null,
      noWait
    )
    const done = hooks.onInherited(chainOf('lib-a'), resultsOf(chainOf('lib-a')))
    await flushPromises()
    await settle()
    await done
    expect(seen).toEqual([])
  })

  it('sends the check runs of several chains one at a time', async () => {
    const { api, sent, settle } = publishing()
    const hooks = chainChecks(
      api,
      'abc',
      () => undefined,
      () => undefined,
      null,
      noWait
    )
    for (const project of ['lib-a', 'lib-b', 'lib-c']) void hooks.onInherited(chainOf(project), resultsOf(chainOf(project)))
    await flushPromises()
    const first = sent.map(([name]) => name)
    await settle()
    expect({ first, afterOneAnswer: sent.map(([name]) => name) }).toEqual({
      first: ['lib-a (linux)'],
      afterOneAnswer: ['lib-a (linux)', 'lib-b (linux)'],
    })
  })

  it('rests a second after each check run it creates, as the API asks of requests that create content', async () => {
    const waits: number[] = []
    const { api, settle } = publishing()
    const wait = async (ms: number): Promise<void> => void waits.push(ms)
    const hooks = chainChecks(
      api,
      'abc',
      () => undefined,
      () => undefined,
      null,
      wait
    )
    const done = ['lib-a', 'lib-b'].map((project) => hooks.onInherited(chainOf(project), resultsOf(chainOf(project))))
    await flushPromises()
    await settle()
    await settle()
    await done[1]
    expect(waits).toEqual([1000, 1000])
  })

  it('sends nothing more after a refusal, with one notice', async () => {
    const notices: string[] = []
    const { api, sent, settle } = publishing()
    const hooks = chainChecks(
      api,
      'abc',
      (message) => notices.push(message),
      () => undefined,
      null,
      noWait
    )
    const all = ['lib-a', 'lib-b'].map((project) => hooks.onInherited(chainOf(project), resultsOf(chainOf(project))))
    await flushPromises()
    await settle(new CheckRefusal('POST', 'check-runs', 403))
    await all[1]
    expect({ notices, sent: sent.map(([name]) => name) }).toEqual({
      notices: ['check runs are off for this run: POST check-runs answered 403'],
      sent: ['lib-a (linux)'],
    })
  })

  it('goes on to the next chain when a request got no answer', async () => {
    const notices: string[] = []
    const { api, sent, settle } = publishing()
    const hooks = chainChecks(
      api,
      'abc',
      (message) => notices.push(message),
      () => undefined,
      null,
      noWait
    )
    for (const project of ['lib-a', 'lib-b']) void hooks.onInherited(chainOf(project), resultsOf(chainOf(project)))
    await flushPromises()
    await settle(new Error('fetch failed'))
    expect({ notices, sent: sent.map(([name]) => name) }).toEqual({
      notices: ['the check run of lib-a (linux) missed a request: fetch failed'],
      sent: ['lib-a (linux)', 'lib-b (linux)'],
    })
  })
})
