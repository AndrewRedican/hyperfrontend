import type { Ending as EndingKind } from './matrix'
import type { ProgressView, TaskEnd, ViewOptions, ViewTask } from './view'
import { describe, expect, it } from '@hyperfrontend/testing'
import { Ending } from './matrix'
import { createTerminal } from './terminal'
import { createProgressView } from './view'

/** A view over output that is kept, with a clock the case moves. */
interface Fixture {
  /** The view. */
  readonly view: ProgressView
  /** Moves the clock forward. */
  readonly wait: (ms: number) => void
  /** Everything written, in order. */
  readonly written: string[]
  /** Everything written as lines, without the newline that ends the last. */
  readonly lines: () => string[]
}

/** Two stages over two projects. */
const TASKS: readonly ViewTask[] = [
  { id: 'lib-core:lint', project: 'lib-core', target: 'lint', stage: 0 },
  { id: 'lib-util:lint', project: 'lib-util', target: 'lint', stage: 0 },
  { id: 'lib-core:test', project: 'lib-core', target: 'test', stage: 1 },
]

/**
 * A view over output that is kept.
 *
 * @param tty - Whether the output is a terminal that can rewrite a line
 * @param options - What the view is given beyond the defaults of the fixture
 * @returns The view, its clock and what it wrote
 */
function fixture(tty: boolean, options: Partial<ViewOptions> = {}): Fixture {
  const written: string[] = []
  let at = 1000
  const terminal = createTerminal({ isTTY: tty, columns: 60, write: (text) => written.push(text) }, {})
  const view = createProgressView({ tasks: TASKS, stages: 2, terminal, now: () => at, ...options })
  return { view, wait: (ms) => void (at += ms), written, lines: () => written.join('').replace(/\n$/, '').split(/\r?\n/) }
}

/**
 * How a task ended, with nothing beyond its ending unless named.
 *
 * @param id - `<project>:<target>`
 * @param ending - How it ended
 * @param extra - The duration, the detail, the excerpt or the log
 * @returns The end of the task
 */
function end(id: string, ending: EndingKind, extra: Partial<TaskEnd> = {}): TaskEnd {
  return { id, ending, durationMs: 4200, detail: null, excerpt: null, log: null, ...extra }
}

describe('createProgressView', () => {
  it('names a stage by the targets of the tasks in it, a prerequisite of another target among them', () => {
    const tasks = [...TASKS, { id: 'lib-core:build', project: 'lib-core', target: 'build', stage: 1 }]
    const { view, lines } = fixture(false, { tasks })
    view.stage(1)
    expect(lines()).toEqual(['stage 2 of 2: test, build (2 tasks)'])
  })

  it('says which stage starts, what it holds and how many there are', () => {
    const { view, lines } = fixture(false)
    view.stage(0)
    view.stage(1)
    expect(lines()).toEqual(['stage 1 of 2: lint (2 tasks)', 'stage 2 of 2: test (1 task)'])
  })

  it('says nothing of the stage when the run has one', () => {
    const { view, written } = fixture(false, { stages: 1 })
    view.stage(0)
    expect(written).toEqual([])
  })

  it('writes a line per task that ends, with its duration and its place in the count', () => {
    const { view, lines } = fixture(false)
    view.ended(end('lib-core:lint', Ending.Passed))
    view.ended(end('lib-util:lint', Ending.Passed, { durationMs: 61_000 }))
    expect(lines()).toEqual(['✓ lib-core:lint  4.2s  [1/3]', '✓ lib-util:lint  1m 1s  [2/3]'])
  })

  it('writes why a task did not run in place of a duration', () => {
    const { view, lines } = fixture(false)
    view.ended(end('lib-core:test', Ending.Skipped, { durationMs: 0, detail: 'lib-core:build did not succeed' }))
    expect(lines()).toEqual(['- lib-core:test  lib-core:build did not succeed  [1/3]'])
  })

  it('writes the excerpt of a failed task and where its log is under its line', () => {
    const { view, lines } = fixture(false)
    view.ended(end('lib-core:lint', Ending.Failed, { excerpt: 'src/a.ts:1 error\nsrc/b.ts:2 error', log: '.hf/logs/lib-core__lint.log' }))
    expect(lines()).toEqual([
      '✗ lib-core:lint  4.2s  [1/3]',
      '    src/a.ts:1 error',
      '    src/b.ts:2 error',
      '    log: .hf/logs/lib-core__lint.log',
    ])
  })

  it('writes the line of a failed task alone when it printed nothing and wrote no log', () => {
    const { view, lines } = fixture(false)
    view.ended(end('lib-core:lint', Ending.Failed))
    expect(lines()).toEqual(['✗ lib-core:lint  4.2s  [1/3]'])
  })

  it('writes no excerpt for a task that did not fail', () => {
    const { view, lines } = fixture(false)
    view.ended(end('lib-core:lint', Ending.Passed, { excerpt: 'noise', log: '.hf/logs/lib-core__lint.log' }))
    expect(lines()).toEqual(['✓ lib-core:lint  4.2s  [1/3]'])
  })

  it('shows nothing of a task that has not run long on a terminal', () => {
    const { view, wait, written } = fixture(true)
    view.started('lib-core:lint')
    wait(2999)
    view.tick()
    expect(written).toEqual([])
  })

  it('shows every task that has run long as the status of a terminal, each with its time', () => {
    const { view, wait, written } = fixture(true)
    view.started('lib-core:lint')
    wait(4000)
    view.started('lib-util:lint')
    wait(3000)
    view.tick()
    expect(written).toEqual(['\r\u001B[2K… lib-core:lint 7s, … lib-util:lint 3s'])
  })

  it('takes the time before a terminal shows a task from the options', () => {
    const { view, wait, written } = fixture(true, { thresholdMs: 10 })
    view.started('lib-core:lint')
    wait(10)
    view.tick()
    expect(written).toEqual(['\r\u001B[2K… lib-core:lint 0s'])
  })

  it('shows a task no longer once it ended', () => {
    const { view, wait, written } = fixture(true)
    view.started('lib-core:lint')
    wait(5000)
    view.ended(end('lib-core:lint', Ending.Passed))
    written.length = 0
    view.tick()
    expect(written).toEqual([])
  })

  it('writes a line for a task still running at each interval on plain output', () => {
    const { view, wait, lines } = fixture(false)
    view.started('lib-core:lint')
    wait(29_000)
    view.tick()
    wait(1000)
    view.tick()
    wait(1000)
    view.tick()
    wait(29_000)
    view.tick()
    expect(lines()).toEqual(['… lib-core:lint still running (30s)', '… lib-core:lint still running (1m 0s)'])
  })

  it('takes the interval of plain output from the options', () => {
    const { view, wait, lines } = fixture(false, { intervalMs: 500 })
    view.started('lib-core:lint')
    wait(500)
    view.tick()
    expect(lines()).toEqual(['… lib-core:lint still running (0.5s)'])
  })

  it('ends on the matrix and the totals, showing what never ended as not run', () => {
    const { view, wait, lines } = fixture(false)
    view.ended(end('lib-core:lint', Ending.Passed))
    wait(65_000)
    view.finish(null)
    expect(lines().slice(1)).toEqual([
      '',
      '          lint  test',
      'lib-core  ✓     ·',
      'lib-util  ·',
      '✓ passed  ✗ failed  - skipped  · not run',
      '',
      '3 tasks in 1m 5s: 1 passed, 2 not run',
    ])
  })

  it('names the stage that ended the run and lists the failed tasks with their logs last', () => {
    const { view, lines } = fixture(false)
    view.ended(end('lib-core:lint', Ending.Failed, { log: '.hf/logs/lib-core__lint.log' }))
    view.ended(end('lib-util:lint', Ending.Failed))
    view.finish(0)
    expect(lines().slice(3)).toEqual([
      'stage 1 (lint) did not succeed: 1 task not run',
      '',
      '          lint  test',
      'lib-core  ✗     ·',
      'lib-util  ✗',
      '✓ passed  ✗ failed  - skipped  · not run',
      '',
      '3 tasks in 0s: 2 failed, 1 not run',
      '✗ lib-core:lint  .hf/logs/lib-core__lint.log',
      '✗ lib-util:lint',
    ])
  })
})
