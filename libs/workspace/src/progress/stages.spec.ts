import type { StagedTask } from './stages'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { assignStages, runStages } from './stages'

/** The stages of a local run: the cheap checks, the tests, then the builds and what follows them. */
const STAGES = [['typecheck', 'lint'], ['test'], ['build', 'e2e']]

/**
 * A task of the fixture.
 *
 * @param id - `<project>:<target>`
 * @param needs - The ids it runs after
 * @returns The task, its target read off its id
 */
function task(id: string, ...needs: string[]): StagedTask {
  return { id, target: id.slice(id.indexOf(':') + 1), needs }
}

/**
 * Runs staged tasks, recording the stages that started.
 *
 * @param stageOf - The stage of each task by id
 * @param failing - The stage that does not succeed, or -1 for none
 * @returns How the run ended and the ids each started stage was given
 */
async function staged(stageOf: ReadonlyMap<string, number>, failing: number): Promise<unknown> {
  const started: string[][] = []
  const run = await runStages({
    tasks: [...stageOf.keys()].map((id) => ({ id })),
    stageOf,
    runStage: async (tasks, stage) => {
      started.push(tasks.map((member) => member.id))
      return stage !== failing
    },
  })
  return { run, started }
}

describe('assignStages', () => {
  it('gives a task the first stage that names its target', () => {
    expect([...assignStages([task('a:lint'), task('a:test'), task('a:e2e')], STAGES)]).toEqual([
      ['a:lint', 0],
      ['a:test', 1],
      ['a:e2e', 2],
    ])
  })

  it('gives a target no stage names the last stage', () => {
    expect(assignStages([task('a:probe')], STAGES).get('a:probe')).toBe(2)
  })

  it('moves a prerequisite to the earliest stage that needs it', () => {
    expect([...assignStages([task('a:build'), task('a:test', 'a:build'), task('a:e2e', 'a:build'), task('b:build')], STAGES)]).toEqual([
      ['a:build', 1],
      ['a:test', 1],
      ['a:e2e', 2],
      ['b:build', 2],
    ])
  })

  it('moves what a moved prerequisite needs along with it, whatever the order given', () => {
    expect([...assignStages([task('root:install'), task('a:build', 'root:install'), task('a:typecheck', 'a:build')], STAGES)]).toEqual([
      ['root:install', 0],
      ['a:build', 0],
      ['a:typecheck', 0],
    ])
  })

  it('leaves a task in the stage that names it when a later stage needs it', () => {
    expect(assignStages([task('a:typecheck'), task('a:build', 'a:typecheck')], STAGES).get('a:typecheck')).toBe(0)
  })

  it('passes over a need that is not among the tasks', () => {
    expect([...assignStages([task('a:test', 'elsewhere:build')], STAGES)]).toEqual([['a:test', 1]])
  })

  it('puts every task in one stage when no stage is given', () => {
    expect([...assignStages([task('a:build'), task('a:test')], [])]).toEqual([
      ['a:build', 0],
      ['a:test', 0],
    ])
  })
})

describe('runStages', () => {
  const stageOf = createMap<string, number>([
    ['a:test', 1],
    ['a:lint', 0],
    ['a:e2e', 3],
    ['b:lint', 0],
  ])

  it('runs the stages in order, each with its tasks in the order given, passing over a stage with none', async () => {
    expect(await staged(stageOf, -1)).toEqual({
      run: { stopped: null, notRun: [] },
      started: [['a:lint', 'b:lint'], ['a:test'], ['a:e2e']],
    })
  })

  it('stops after the stage that did not succeed and names the tasks that never started', async () => {
    expect(await staged(stageOf, 0)).toEqual({
      run: { stopped: 0, notRun: ['a:test', 'a:e2e'] },
      started: [['a:lint', 'b:lint']],
    })
  })

  it('names no task when the last stage is the one that did not succeed', async () => {
    expect(await staged(stageOf, 3)).toEqual(expect.objectContaining({ run: { stopped: 3, notRun: [] } }))
  })
})
