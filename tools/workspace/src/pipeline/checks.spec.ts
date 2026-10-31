import type { CheckApi } from './checks'
import type { Chain, TaskResult } from './model'
import { from as arrayFrom } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { CheckRefusal, chainChecks, chainConclusion, chainOutput, checkName } from './checks'

/** A chain of one build. */
const CHAIN: Chain = {
  project: 'lib-a',
  environment: 'linux',
  order: 0,
  tasks: [
    {
      id: 'lib-a:build',
      project: 'lib-a',
      target: 'build',
      environment: 'linux',
      needs: [],
      weight: 'heavy',
      reasons: [],
      command: [],
      env: {},
    },
  ],
}

/**
 * A result.
 *
 * @param outcome - How the build ended
 * @returns The result of the chain's build
 */
function result(outcome: TaskResult['outcome']): TaskResult {
  return {
    id: 'lib-a:build',
    project: 'lib-a',
    target: 'build',
    environment: 'linux',
    reasons: [],
    outcome,
    exitCode: 0,
    detail: null,
    startedAt: 0,
    endedAt: 1000,
    durationMs: 1000,
    log: null,
  }
}

/**
 * A chain of the build repeated.
 *
 * @param project - The project the chain is of
 * @param size - How many tasks it has
 * @returns The chain of the project, its build repeated `size` times
 */
function chainOf(project: string, size: number): Chain {
  return { ...CHAIN, project, tasks: CHAIN.tasks.flatMap((task) => arrayFrom({ length: size }, () => task)) }
}

/**
 * The results of a chain's first tasks, the last of a failed chain failing.
 *
 * @param count - How many tasks ended
 * @param outcome - How the last of them ended
 * @returns The results
 */
function ended(count: number, outcome: TaskResult['outcome'] = 'success'): TaskResult[] {
  return arrayFrom({ length: count }, (_, index) => result(index === count - 1 ? outcome : 'success'))
}

describe('chainOutput', () => {
  it('shows what each failed task printed under the table', () => {
    const output = chainOutput(CHAIN, [{ ...result('failure'), excerpt: '✖ a spec failed' }], 'done')
    expect(output.summary).toContain(
      '### Failures\n\n<details open><summary><code>lib-a:build</code></summary>\n\n````text\n✖ a spec failed\n````'
    )
  })

  it('carries the table and the chain state', () => {
    expect(chainOutput(CHAIN, [result('success')], 'done')).toEqual({
      title: 'done',
      summary: expect.stringContaining('| `lib-a:build` | ✅ success | 1s |  |'),
      text: stringify({
        schema: 1,
        project: 'lib-a',
        environment: 'linux',
        total: 1,
        tasks: [{ id: 'lib-a:build', outcome: 'success', exitCode: 0, detail: null, startedAt: 0, endedAt: 1000 }],
      }),
    })
  })
})

describe('checkName', () => {
  it('names the project and the environment', () => {
    expect(checkName(CHAIN)).toBe('lib-a (linux)')
  })
})

describe('chainConclusion', () => {
  it.each([
    [[result('success')], 'success'],
    [[result('success'), result('failure')], 'failure'],
    [[result('skipped')], 'failure'],
    [[result('success'), result('cancelled')], 'cancelled'],
  ])('concludes %j as %s', (results, conclusion) => {
    expect(chainConclusion(results)).toBe(conclusion)
  })
})

describe('chainChecks', () => {
  /**
   * An API recording its calls.
   *
   * @param failing - Whether every call fails
   * @returns The API and the calls
   */
  function recording(failing = false): { api: CheckApi; calls: unknown[] } {
    const calls: unknown[] = []
    return {
      calls,
      api: {
        create: async (name, headSha) => {
          if (failing) throw new CheckRefusal('POST', 'check-runs', 403)
          calls.push(['create', name, headSha])
          return 9
        },
        update: async (id, output) => {
          calls.push(['update', id, output.title])
        },
        complete: async (id, conclusion, output) => {
          calls.push(['complete', id, conclusion, output.title])
        },
      },
    }
  }

  it('creates the check run as the chain starts and completes it as the chain ends', async () => {
    const { api, calls } = recording()
    const hooks = chainChecks(api, 'abc', () => undefined)
    await hooks.onStart(CHAIN)
    await hooks.onEnd(CHAIN, [result('success')])
    expect(calls).toEqual([
      ['create', 'lib-a (linux)', 'abc'],
      ['complete', 9, 'success', '1 tasks, success'],
    ])
  })

  it('rewrites the check run as a task of the chain ends', async () => {
    const { api, calls } = recording()
    const hooks = chainChecks(api, 'abc', () => undefined)
    await hooks.onStart(CHAIN)
    await hooks.onTask(CHAIN, [result('success')])
    expect(calls).toEqual([
      ['create', 'lib-a (linux)', 'abc'],
      ['update', 9, '1 of 1 tasks ended'],
    ])
  })

  it('reports the check runs as they are created and completed', async () => {
    const seen: unknown[] = []
    const hooks = chainChecks(
      recording().api,
      'abc',
      () => undefined,
      (records) => seen.push(records)
    )
    await hooks.onStart(CHAIN)
    await hooks.onEnd(CHAIN, [result('success')])
    expect(seen).toEqual([{ 'lib-a (linux)': { id: 9, completed: false } }, { 'lib-a (linux)': { id: 9, completed: true } }])
  })

  it('completes nothing for a chain that never started', async () => {
    const { api, calls } = recording()
    const hooks = chainChecks(api, 'abc', () => undefined)
    await hooks.onTask(CHAIN, [result('success')])
    await hooks.onEnd(CHAIN, [result('success')])
    expect(calls).toEqual([])
  })

  it('switches off after one refusal, with one notice', async () => {
    const notices: string[] = []
    const { api, calls } = recording(true)
    const hooks = chainChecks(api, 'abc', (message) => notices.push(message))
    await hooks.onStart(CHAIN)
    await hooks.onStart({ ...CHAIN, project: 'lib-b' })
    await hooks.onEnd(CHAIN, [result('success')])
    expect({ notices, calls }).toEqual({ notices: ['check runs are off for this run: POST check-runs answered 403'], calls: [] })
  })

  it('speaks once when several chains are refused at the same time', async () => {
    const notices: string[] = []
    const { api } = recording(true)
    const hooks = chainChecks(api, 'abc', (message) => notices.push(message))
    await promiseAll([hooks.onStart(CHAIN), hooks.onStart({ ...CHAIN, project: 'lib-b' })])
    expect(notices).toEqual(['check runs are off for this run: POST check-runs answered 403'])
  })

  it('describes a failure that is not an error, costing only its chain', async () => {
    const notices: string[] = []
    const hooks = chainChecks(
      { create: async () => Promise.reject('nope'), update: async () => undefined, complete: async () => undefined },
      'abc',
      (message) => notices.push(message)
    )
    await hooks.onStart(CHAIN)
    await hooks.onEnd(CHAIN, [result('success')])
    expect(notices).toEqual(['the check run of lib-a (linux) missed a request: nope'])
  })

  it('keeps the other chains when a create gets no answer', async () => {
    const notices: string[] = []
    const { api, calls } = recording()
    const hooks = chainChecks(
      {
        ...api,
        create: async (name, headSha) => (name.startsWith('lib-b') ? Promise.reject(new Error('fetch failed')) : api.create(name, headSha)),
      },
      'abc',
      (message) => notices.push(message)
    )
    await hooks.onStart(CHAIN)
    await hooks.onStart({ ...CHAIN, project: 'lib-b' })
    await hooks.onEnd({ ...CHAIN, project: 'lib-b' }, [result('success')])
    await hooks.onEnd(CHAIN, [result('success')])
    expect({ notices, calls }).toEqual({
      notices: ['the check run of lib-b (linux) missed a request: fetch failed'],
      calls: [
        ['create', 'lib-a (linux)', 'abc'],
        ['complete', 9, 'success', '1 tasks, success'],
      ],
    })
  })

  it('still completes a check run whose update got no answer', async () => {
    const notices: string[] = []
    const { api, calls } = recording()
    const hooks = chainChecks({ ...api, update: async () => Promise.reject(new Error('fetch failed')) }, 'abc', (message) =>
      notices.push(message)
    )
    const chain = { ...CHAIN, tasks: [...CHAIN.tasks, { ...(CHAIN.tasks[0] as Chain['tasks'][number]), id: 'lib-a:test' }] }
    await hooks.onStart(chain)
    await hooks.onTask(chain, [result('success')])
    await hooks.onEnd(chain, [result('success'), result('success')])
    expect({ notices, calls: calls.map((call) => (call as unknown[])[0]) }).toEqual({
      notices: ['the check run of lib-a (linux) missed a request: fetch failed'],
      calls: ['create', 'complete'],
    })
  })

  /** Settles a request the fake API holds: answered, or refused when told so. */
  type Held = (refused: boolean) => void

  /** An API that answers each request only when the test lets it. */
  interface Holding {
    /** The API. */
    readonly api: CheckApi
    /** What was sent, in order; check runs are numbered from 1 as they are created. */
    readonly sent: unknown[][]
    /** What was sent and answered, in order. */
    readonly log: unknown[][]
    /** The requests not settled yet, oldest first. */
    readonly held: Held[]
  }

  /**
   * An API holding every request until the test settles it.
   *
   * @returns The API, what it was sent and the requests it holds
   */
  function holding(): Holding {
    const sent: unknown[][] = []
    const log: unknown[][] = []
    const held: Held[] = []
    const hold = <T>(call: unknown[], value: T): Promise<T> => {
      const deferred = createDeferred<T>()
      sent.push(call)
      log.push(call)
      held.push((refused) => {
        log.push([refused ? 'refused' : 'answered', call[1]])
        if (refused) deferred.reject(new CheckRefusal('PATCH', 'check-runs', 403))
        else deferred.resolve(value)
      })
      return deferred.promise
    }
    return {
      sent,
      log,
      held,
      api: {
        create: () => {
          const id = sent.filter(([kind]) => kind === 'create').length + 1
          return hold(['create', id], id)
        },
        update: (id, output) => hold(['update', id, output.title], undefined),
        complete: (id, conclusion, output) => hold(['complete', id, conclusion, output.title], undefined),
      },
    }
  }

  /**
   * Settles the oldest or the newest request held, letting the hooks react before and after.
   *
   * @param held - The held requests
   * @param from - Which end to settle
   * @param refused - Whether the API refuses it
   */
  async function release(held: Held[], from: 'oldest' | 'newest', refused = false): Promise<void> {
    await flushPromises()
    const request = (from === 'oldest' ? held.shift() : held.pop()) as Held
    request(refused)
    await flushPromises()
  }

  /**
   * Answers every request held, newest first, until none is held.
   *
   * @param held - The held requests
   */
  async function answerNewestFirst(held: Held[]): Promise<void> {
    await flushPromises()
    while (held.length > 0) await release(held, 'newest')
  }

  it('applies a hook called before the create answered once it has', async () => {
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const pending = [hooks.onStart(chainOf('lib-a', 4)), hooks.onTask(chainOf('lib-a', 4), ended(1))]
    await answerNewestFirst(held)
    await promiseAll(pending)
    expect(sent).toEqual([
      ['create', 1],
      ['update', 1, '1 of 4 tasks ended'],
    ])
  })

  it('collapses updates waiting behind the create into the latest state', async () => {
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const chain = chainOf('lib-a', 4)
    const pending = [hooks.onStart(chain), hooks.onTask(chain, ended(1)), hooks.onTask(chain, ended(2))]
    await answerNewestFirst(held)
    await promiseAll(pending)
    expect(sent).toEqual([
      ['create', 1],
      ['update', 1, '2 of 4 tasks ended'],
    ])
  })

  it('collapses updates waiting behind an update in flight into the latest state', async () => {
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const chain = chainOf('lib-a', 4)
    const pending = [hooks.onStart(chain)]
    await release(held, 'oldest')
    pending.push(hooks.onTask(chain, ended(1)))
    await flushPromises()
    pending.push(hooks.onTask(chain, ended(2)), hooks.onTask(chain, ended(3)))
    await answerNewestFirst(held)
    await promiseAll(pending)
    expect(sent).toEqual([
      ['create', 1],
      ['update', 1, '1 of 4 tasks ended'],
      ['update', 1, '3 of 4 tasks ended'],
    ])
  })

  it('drops a waiting update once the completion is queued', async () => {
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const chain = chainOf('lib-a', 4)
    const pending = [hooks.onStart(chain), hooks.onTask(chain, ended(1)), hooks.onEnd(chain, ended(4))]
    await answerNewestFirst(held)
    await promiseAll(pending)
    expect(sent).toEqual([
      ['create', 1],
      ['complete', 1, 'success', '4 tasks, success'],
    ])
  })

  it('sends nothing for a hook called after the completion', async () => {
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const chain = chainOf('lib-a', 4)
    const pending = [hooks.onStart(chain), hooks.onEnd(chain, ended(4)), hooks.onTask(chain, ended(4))]
    await answerNewestFirst(held)
    await promiseAll(pending)
    expect(sent).toEqual([
      ['create', 1],
      ['complete', 1, 'success', '4 tasks, success'],
    ])
  })

  it('answers a collapsed hook once the update it joined is done', async () => {
    const { api, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const chain = chainOf('lib-a', 4)
    let done = false
    const pending = [
      hooks.onStart(chain),
      hooks.onTask(chain, ended(1)),
      hooks.onTask(chain, ended(2)).then(() => {
        done = true
      }),
    ]
    await release(held, 'oldest')
    const sentOnly = done
    await release(held, 'oldest')
    await promiseAll(pending)
    expect({ sentOnly, answered: done }).toEqual({ sentOnly: false, answered: true })
  })

  it('keeps each chain in order, the completion last, when answers arrive newest first', async () => {
    const { api, log, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const [a, b] = [chainOf('lib-a', 3), chainOf('lib-b', 3)]
    const pending = [hooks.onStart(a), hooks.onStart(b)]
    await answerNewestFirst(held)
    pending.push(hooks.onTask(a, ended(1)), hooks.onTask(b, ended(1)))
    await flushPromises()
    // how: a failure skips the rest of each chain in one pass, so its last update and its completion arrive together
    pending.push(hooks.onTask(a, ended(2, 'failure')), hooks.onEnd(a, ended(3, 'skipped')))
    pending.push(hooks.onTask(b, ended(2, 'failure')), hooks.onEnd(b, ended(3, 'skipped')))
    await answerNewestFirst(held)
    await promiseAll(pending)
    expect({ a: log.filter(([, id]) => id === 1), b: log.filter(([, id]) => id === 2) }).toEqual({
      a: [
        ['create', 1],
        ['answered', 1],
        ['update', 1, '1 of 3 tasks ended'],
        ['answered', 1],
        ['complete', 1, 'failure', '3 tasks, failure'],
        ['answered', 1],
      ],
      b: [
        ['create', 2],
        ['answered', 2],
        ['update', 2, '1 of 3 tasks ended'],
        ['answered', 2],
        ['complete', 2, 'failure', '3 tasks, failure'],
        ['answered', 2],
      ],
    })
  })

  it('sends nothing more for a chain whose create is refused', async () => {
    const notices: string[] = []
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', (message) => notices.push(message))
    const chain = chainOf('lib-a', 4)
    const pending = [hooks.onStart(chain), hooks.onTask(chain, ended(1)), hooks.onEnd(chain, ended(4))]
    await release(held, 'oldest', true)
    await promiseAll(pending)
    expect({ notices, sent }).toEqual({
      notices: ['check runs are off for this run: PATCH check-runs answered 403'],
      sent: [['create', 1]],
    })
  })

  it('sends no waiting update once another chain is refused', async () => {
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', () => undefined)
    const pending = [hooks.onStart(chainOf('lib-a', 4)), hooks.onStart(chainOf('lib-b', 4)), hooks.onTask(chainOf('lib-a', 4), ended(1))]
    await release(held, 'newest', true)
    await release(held, 'oldest')
    await promiseAll(pending)
    expect(sent).toEqual([
      ['create', 1],
      ['create', 2],
    ])
  })

  it('sends no queued completion once another chain is refused', async () => {
    const seen: unknown[] = []
    const { api, held } = holding()
    const hooks = chainChecks(
      api,
      'abc',
      () => undefined,
      (records) => seen.push(records)
    )
    const pending = [hooks.onStart(chainOf('lib-a', 4)), hooks.onStart(chainOf('lib-b', 4)), hooks.onEnd(chainOf('lib-a', 4), ended(4))]
    await release(held, 'newest', true)
    await release(held, 'oldest')
    await promiseAll(pending)
    expect(seen).toEqual([{ 'lib-a (linux)': { id: 1, completed: false } }])
  })

  it('sends nothing after a refused update, with one notice', async () => {
    const notices: string[] = []
    const { api, sent, held } = holding()
    const hooks = chainChecks(api, 'abc', (message) => notices.push(message))
    const chain = chainOf('lib-a', 4)
    const pending = [hooks.onStart(chain)]
    await release(held, 'oldest')
    pending.push(hooks.onTask(chain, ended(1)))
    await flushPromises()
    pending.push(hooks.onEnd(chain, ended(4)))
    await release(held, 'oldest', true)
    await promiseAll(pending)
    expect({ notices, sent }).toEqual({
      notices: ['check runs are off for this run: PATCH check-runs answered 403'],
      sent: [
        ['create', 1],
        ['update', 1, '1 of 4 tasks ended'],
      ],
    })
  })
})
