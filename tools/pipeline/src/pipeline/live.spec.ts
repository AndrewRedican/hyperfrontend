import type { Chain, Origin, Plan, PlanTask, TaskResult } from './model'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { taskCommand } from './commands'
import { chainState, CHECK_TEXT_LIMIT, clip, compactPlan, planCheckOutput } from './live'

/**
 * A task.
 *
 * @param project - The chain's project
 * @param target - What the task runs
 * @param needs - What must succeed first
 * @returns The task, with one reason
 */
function task(project: string, target: string, needs: string[] = []): PlanTask {
  return {
    id: `${project}:${target}`,
    project,
    target,
    environment: 'linux',
    needs,
    weight: target === 'build' ? 'heavy' : 'light',
    reasons: [{ rule: 'changed-input', file: `libs/${project}/src/index.ts`, path: [], message: 'an own file changed' }],
    command: taskCommand(`${project}:${target}`),
    env: {},
  }
}

/** A plan of one chain. */
const PLAN: Plan = {
  base: 'abcdef0123456789',
  head: '0123456789abcdef',
  mode: 'affected',
  main: false,
  targets: ['typecheck', 'build'],
  drift: [],
  chains: [
    { project: 'lib-a', environment: 'linux', order: 0, tasks: [task('lib-a', 'typecheck'), task('lib-a', 'build', ['lib-a:typecheck'])] },
  ],
  skipped: [{ task: 'lib-b:build', reasons: [{ rule: 'unreachable', file: null, path: [], message: 'nothing reaches it' }] }],
  environments: ['linux'],
}

/**
 * A plan with many chains.
 *
 * @param count - How many chains
 * @returns The plan
 */
function wide(count: number): Plan {
  const chains: Chain[] = []
  for (let index = 0; index < count; index += 1) {
    const project = `lib-${index}`
    chains.push({
      project,
      environment: 'linux',
      order: index,
      tasks: [task(project, 'typecheck'), task(project, 'build', [`${project}:typecheck`])],
    })
  }
  return { ...PLAN, chains }
}

describe('compactPlan', () => {
  it('keeps the chains, tasks and needs and drops the reasons', () => {
    expect(compactPlan(PLAN)).toEqual({
      schema: 1,
      base: 'abcdef0123456789',
      head: '0123456789abcdef',
      mode: 'affected',
      main: false,
      environments: ['linux'],
      chains: [
        {
          project: 'lib-a',
          environment: 'linux',
          order: 0,
          tasks: [
            { id: 'lib-a:typecheck', target: 'typecheck', weight: 'light', needs: [] },
            { id: 'lib-a:build', target: 'build', weight: 'heavy', needs: ['lib-a:typecheck'] },
          ],
        },
      ],
      skipped: 1,
      truncated: false,
    })
  })

  it('drops the needs when the text would not fit', () => {
    const compact = compactPlan(wide(400), 60000)
    expect({ truncated: compact.truncated, needs: compact.chains.flatMap((chain) => chain.tasks.flatMap((item) => item.needs)) }).toEqual({
      truncated: true,
      needs: [],
    })
  })
})

describe('compactPlan of a plan with inherited tasks', () => {
  /**
   * Where an inherited task ran.
   *
   * @param run - The workflow run
   * @param endedAt - When the task ended
   * @returns A first attempt of that run on Node.js 24.18.0
   */
  function origin(run: number, endedAt: number): Origin {
    return { run, attempt: 1, sha: 'abcdef0123456789', url: null, tree: '0123456789abcdef', node: 'v24.18.0', endedAt }
  }

  const inheriting: Plan = {
    ...PLAN,
    chains: [
      {
        project: 'lib-a',
        environment: 'linux',
        order: 0,
        tasks: [
          { ...task('lib-a', 'typecheck'), inherited: origin(7, 100) },
          { ...task('lib-a', 'lint'), inherited: origin(8, 200) },
          { ...task('lib-a', 'test'), inherited: origin(7, 300) },
          task('lib-a', 'build', ['lib-a:typecheck']),
        ],
      },
    ],
  }

  it('lists each run the inherited tasks come from once, without the end of any one task', () => {
    expect(compactPlan(inheriting).origins).toEqual([
      { run: 7, attempt: 1, sha: 'abcdef0123456789', url: null, tree: '0123456789abcdef', node: 'v24.18.0' },
      { run: 8, attempt: 1, sha: 'abcdef0123456789', url: null, tree: '0123456789abcdef', node: 'v24.18.0' },
    ])
  })

  it('names the run of an inherited task by its position, and gives a task that runs none', () => {
    expect(compactPlan(inheriting).chains.flatMap((chain) => chain.tasks.map((item) => [item.target, item.from ?? null]))).toEqual([
      ['typecheck', 0],
      ['lint', 1],
      ['test', 0],
      ['build', null],
    ])
  })

  it('lists no origins for a plan no task of which inherits', () => {
    expect('origins' in compactPlan(PLAN)).toBe(false)
  })
})

describe('chainState', () => {
  const ended: TaskResult = {
    id: 'lib-a:typecheck',
    project: 'lib-a',
    target: 'typecheck',
    environment: 'linux',
    reasons: [],
    outcome: 'success',
    exitCode: null,
    detail: 'inherited from run 7 (abcdef0): nothing it reads changed since',
    startedAt: null,
    endedAt: null,
    durationMs: 0,
    log: null,
    inherited: { run: 7, attempt: 1, sha: 'abcdef0123456789', url: null, tree: '0123456789abcdef', node: 'v24.18.0', endedAt: 100 },
  }

  it('carries the run an inherited task comes from', () => {
    expect(parse(chainState(PLAN.chains[0] as Chain, [ended])).tasks).toEqual([
      {
        id: 'lib-a:typecheck',
        outcome: 'success',
        exitCode: null,
        detail: 'inherited from run 7 (abcdef0): nothing it reads changed since',
        startedAt: null,
        endedAt: null,
        inherited: 7,
      },
    ])
  })
})

describe('planCheckOutput', () => {
  it('titles the counts, summarises the plan and carries the compact plan', () => {
    const output = planCheckOutput(PLAN)
    expect({ title: output.title, summary: output.summary.split(/\r?\n/)[0], text: parse(output.text ?? '') }).toEqual({
      title: '1 chains, 2 tasks',
      summary: '## Pipeline plan',
      text: compactPlan(PLAN),
    })
  })

  it('keeps the summary and the text within the limit of a plan twice as wide as this workspace can plan', () => {
    const output = planCheckOutput(wide(150))
    expect([
      new TextEncoder().encode(output.summary).length <= CHECK_TEXT_LIMIT,
      (output.text ?? '').length <= CHECK_TEXT_LIMIT,
      parse(output.text ?? '').truncated,
    ]).toEqual([true, true, false])
  })
})

describe('clip', () => {
  it('leaves short text alone', () => {
    expect(clip('short', 10)).toBe('short')
  })

  it('cuts long text to the limit and says so', () => {
    const cut = clip('x'.repeat(200), 100)
    expect({
      bytes: new TextEncoder().encode(cut).length,
      note: cut.endsWith('\n\n… truncated; the pipeline-plan artifact holds the whole plan.'),
    }).toEqual({
      bytes: 100,
      note: true,
    })
  })

  it('counts the limit in UTF-8 bytes and never splits a character', () => {
    const cut = clip('a → b\n'.repeat(50), 100)
    expect({ bytes: new TextEncoder().encode(cut).length <= 100, whole: !cut.includes('�'), clipped: cut.startsWith('a → b\n') }).toEqual({
      bytes: true,
      whole: true,
      clipped: true,
    })
  })
})
