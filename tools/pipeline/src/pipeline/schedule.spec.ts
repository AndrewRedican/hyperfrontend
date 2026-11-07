import type { RunOutcome } from './execute'
import type { ScheduleResult, ScheduleTask } from './schedule'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createDeferred, describe, expect, it, sleep } from '@hyperfrontend/testing'
import { runSchedule, validateSchedule } from './schedule'

/** A task of a test schedule. */
interface TestTask extends ScheduleTask {
  /** What the task ends as. */
  readonly ends: RunOutcome['outcome']
}

/**
 * A task.
 *
 * @param id - What the task is called
 * @param needs - What it needs
 * @param fields - The weight, the order and the outcome
 * @returns A light task of rank 0 that succeeds, unless the fields say otherwise
 */
function task(id: string, needs: readonly string[] = [], fields: Partial<TestTask> = {}): TestTask {
  return { id, needs, weight: 'light', order: 0, ends: 'success', ...fields }
}

/**
 * Runs a task to the outcome it declares.
 *
 * @param item - The task
 * @returns The outcome
 */
async function immediate(item: TestTask): Promise<RunOutcome> {
  return { outcome: item.ends, exitCode: item.ends === 'success' ? 0 : 1, log: null, detail: null }
}

/**
 * The outcomes of a schedule, by id.
 *
 * @param results - What the schedule answered
 * @returns `<id> <outcome>` per task, sorted
 */
function outcomes(results: Map<string, ScheduleResult>): string[] {
  return [...results.values()].map((result) => `${result.id} ${result.outcome}`).sort()
}

describe('validateSchedule', () => {
  it('refuses a need that is not in the schedule', () => {
    expect(() => validateSchedule({ tasks: [task('a', ['b'])], parallel: 1, heavy: 1, run: immediate })).toThrow(
      'a needs b, which is not in the schedule'
    )
  })

  it('refuses a cycle, naming it', () => {
    expect(() =>
      validateSchedule({ tasks: [task('a', ['b']), task('b', ['c']), task('c', ['a'])], parallel: 1, heavy: 1, run: immediate })
    ).toThrow('the schedule has a cycle: a → b → c → a')
  })

  it('refuses an empty budget', () => {
    expect(() => validateSchedule({ tasks: [], parallel: 0, heavy: 1, run: immediate })).toThrow('at least one light and one heavy slot')
  })

  it('accepts a diamond', () => {
    expect(() =>
      validateSchedule({
        tasks: [task('a'), task('b', ['a']), task('c', ['a']), task('d', ['b', 'c'])],
        parallel: 1,
        heavy: 1,
        run: immediate,
      })
    ).not.toThrow()
  })
})

describe('runSchedule', () => {
  it('runs every task when all succeed', async () => {
    const results = await runSchedule({ tasks: [task('a'), task('b', ['a']), task('c')], parallel: 2, heavy: 1, run: immediate })
    expect(outcomes(results)).toEqual(['a success', 'b success', 'c success'])
  })

  it('skips the dependents of a failure and runs the rest', async () => {
    const results = await runSchedule({
      tasks: [task('a', [], { ends: 'failure' }), task('b', ['a']), task('c', ['b']), task('d')],
      parallel: 1,
      heavy: 1,
      run: immediate,
    })
    expect(outcomes(results)).toEqual(['a failure', 'b skipped', 'c skipped', 'd success'])
  })

  it('skips every dependent of a deep failure when dependents are listed before their prerequisites', async () => {
    const results = await runSchedule({
      tasks: [task('e', ['d']), task('d', ['c']), task('c', ['b']), task('b', ['a'], { ends: 'failure' }), task('a'), task('f')],
      parallel: 1,
      heavy: 1,
      run: immediate,
    })
    expect(outcomes(results)).toEqual(['a success', 'b failure', 'c skipped', 'd skipped', 'e skipped', 'f success'])
  })

  it('fails a task whose runner rejects, naming the error, and runs the rest', async () => {
    const results = await runSchedule({
      tasks: [task('a'), task('b', ['a']), task('c')],
      parallel: 1,
      heavy: 1,
      now: () => 0,
      run: async (item) => {
        if (item.id === 'a') throw createError('boom')
        return immediate(item)
      },
    })
    expect({ a: results.get('a'), all: outcomes(results) }).toEqual({
      a: { id: 'a', outcome: 'failure', exitCode: null, detail: 'Error: boom', startedAt: 0, endedAt: 0, durationMs: 0, log: null },
      all: ['a failure', 'b skipped', 'c success'],
    })
  })

  it('fails a task whose runner throws synchronously, naming the error, and runs the rest', async () => {
    const results = await runSchedule({
      tasks: [task('a'), task('b', ['a']), task('c')],
      parallel: 1,
      heavy: 1,
      now: () => 0,
      run: (item) => {
        if (item.id === 'a') throw createError('thrown before any promise')
        return immediate(item)
      },
    })
    expect({ a: results.get('a'), all: outcomes(results) }).toEqual({
      a: {
        id: 'a',
        outcome: 'failure',
        exitCode: null,
        detail: 'Error: thrown before any promise',
        startedAt: 0,
        endedAt: 0,
        durationMs: 0,
        log: null,
      },
      all: ['a failure', 'b skipped', 'c success'],
    })
  })

  it('names the prerequisite that failed', async () => {
    const results = await runSchedule({
      tasks: [task('a', [], { ends: 'failure' }), task('b', ['a'])],
      parallel: 1,
      heavy: 1,
      run: immediate,
    })
    expect(results.get('b')?.detail).toBe('prerequisite-failed: a')
  })

  it('runs a task only after every need succeeded', async () => {
    const order: string[] = []
    await runSchedule({
      tasks: [task('d', ['b', 'c']), task('b', ['a']), task('c', ['a']), task('a')],
      parallel: 4,
      heavy: 1,
      run: async (item) => {
        order.push(item.id)
        return immediate(item)
      },
    })
    expect([order[0], order[3], order.slice(1, 3).sort()]).toEqual(['a', 'd', ['b', 'c']])
  })

  it('keeps the light and heavy budgets', async () => {
    const running = { light: 0, heavy: 0 }
    const peaks = { light: 0, heavy: 0 }
    const results = await runSchedule({
      tasks: [
        task('l1'),
        task('l2'),
        task('l3'),
        task('h1', [], { weight: 'heavy' }),
        task('h2', [], { weight: 'heavy' }),
        task('h3', [], { weight: 'heavy' }),
      ],
      parallel: 2,
      heavy: 1,
      run: async (item) => {
        running[item.weight] += 1
        peaks[item.weight] = running[item.weight] > peaks[item.weight] ? running[item.weight] : peaks[item.weight]
        await sleep(1)
        running[item.weight] -= 1
        return immediate(item)
      },
    })
    expect({ peaks, ran: results.size }).toEqual({ peaks: { light: 2, heavy: 1 }, ran: 6 })
  })

  it('serves the ready tasks by rank', async () => {
    const order: string[] = []
    await runSchedule({
      tasks: [task('late', [], { order: 5 }), task('early', [], { order: 1 }), task('middle', [], { order: 3 })],
      parallel: 1,
      heavy: 1,
      run: async (item) => {
        order.push(item.id)
        return immediate(item)
      },
    })
    expect(order).toEqual(['early', 'middle', 'late'])
  })

  it('cancels what has not started once aborted', async () => {
    const controller = new AbortController()
    const results = await runSchedule({
      tasks: [task('a'), task('b', ['a']), task('c')],
      parallel: 1,
      heavy: 1,
      signal: controller.signal,
      run: async (item) => {
        controller.abort()
        return immediate(item)
      },
    })
    expect(outcomes(results)).toEqual(['a success', 'b cancelled', 'c cancelled'])
  })

  it('records when a task started and ended', async () => {
    let tick = 100
    const results = await runSchedule({ tasks: [task('a')], parallel: 1, heavy: 1, run: immediate, now: () => (tick += 5) })
    expect(results.get('a')).toEqual({
      id: 'a',
      outcome: 'success',
      exitCode: 0,
      detail: null,
      startedAt: 105,
      endedAt: 110,
      durationMs: 5,
      log: null,
    })
  })

  it('calls the hooks as tasks start and end', async () => {
    const events: string[] = []
    await runSchedule({
      tasks: [task('a', [], { ends: 'failure' }), task('b', ['a'])],
      parallel: 1,
      heavy: 1,
      run: immediate,
      onStart: (item) => events.push(`start ${item.id}`),
      onEnd: (item, result) => events.push(`end ${item.id} ${result.outcome}`),
    })
    expect(events).toEqual(['start a', 'end a failure', 'end b skipped'])
  })

  it('keeps the detail a run reports', async () => {
    const results = await runSchedule({
      tasks: [task('a')],
      parallel: 1,
      heavy: 1,
      run: async () => ({ outcome: 'failure', exitCode: null, log: 'a.log', detail: 'spawn failed' }),
    })
    expect(results.get('a')).toEqual(expect.objectContaining({ outcome: 'failure', exitCode: null, log: 'a.log', detail: 'spawn failed' }))
  })

  it('ends an empty schedule at once', async () => {
    expect((await runSchedule({ tasks: [], parallel: 1, heavy: 1, run: immediate })).size).toBe(0)
  })
})

describe('runSchedule with slow tasks', () => {
  it('starts a task the moment its last need ends, while others still run', async () => {
    const gates = createMap<string, ReturnType<typeof createDeferred<void>>>([
      ['a', createDeferred<void>()],
      ['b', createDeferred<void>()],
    ])
    const started: string[] = []
    const run = runSchedule({
      tasks: [task('a'), task('b'), task('c', ['a'])],
      parallel: 3,
      heavy: 1,
      run: async (item) => {
        started.push(item.id)
        await gates.get(item.id)?.promise
        return immediate(item)
      },
    })
    gates.get('a')?.resolve()
    await sleep(5)
    const snapshot = [...started]
    gates.get('b')?.resolve()
    await run
    expect(snapshot).toEqual(['a', 'b', 'c'])
  })
})
