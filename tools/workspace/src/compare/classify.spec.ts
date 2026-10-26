import type { NxExplanation } from '../baseline/model'
import type { AffectedSet, Reason, TaskDecision } from '../graph/selection'
import type { RangeComparison } from './classify'
import { describe, expect, it } from '@hyperfrontend/testing'
import { compareTarget, compareTargets, sampleRebuilds, tasksUnder, totalCounts, Verdict } from './classify'

/**
 * A reason with the given rule and file.
 *
 * @param rule - The rule the reason rests on
 * @param file - The changed file it starts from, or null
 * @returns A reason whose message names both
 */
function reason(rule: Reason['rule'], file: string | null): Reason {
  return { rule, file, path: [], message: `${rule} for ${file ?? 'no file'}` }
}

/**
 * An affected set of the build target.
 *
 * @param selected - The selected decisions
 * @param skipped - The skipped decisions
 * @returns The affected set of the build target over an empty change set
 */
function setOf(selected: readonly TaskDecision[], skipped: readonly TaskDecision[]): AffectedSet {
  return {
    target: 'build',
    changes: { base: 'b', head: 'h', changes: [] },
    selected,
    skipped,
    fallbacks: [],
  }
}

/**
 * An explanation naming the given affected tasks.
 *
 * @param affected - Nx's affected tasks with their reasons
 * @returns An explanation with no upstream or touched tasks
 */
function explanationOf(affected: NxExplanation['affected']): NxExplanation {
  return { affected, upstream: {}, touched: [], requested: { targets: ['build'], total: 10 } }
}

const explanation = explanationOf({
  'lib-a:build': [{ kind: 'input-file', file: 'libs/a/src/x.ts', pattern: 'libs/a/**/*' }],
  'lib-b:build': [
    { kind: 'input-file', file: 'libs/a/src/x.ts', pattern: 'libs/a/**/*' },
    { kind: 'project-configuration', file: 'libs/a/src/x.ts' },
  ],
  'lib-c:build': [
    { kind: 'input-file', file: 'libs/a/src/x.ts', pattern: 'libs/a/**/*' },
    { kind: 'npm-package', package: 'npm:left-pad' },
  ],
  'lib-d:build': [{ kind: 'input-file', file: 'libs/a/src/y.ts', pattern: 'libs/a/**/*' }],
  'lib-e:build': [{ kind: 'input-file', file: 'libs/a/src/x.ts', pattern: 'libs/a/**/*' }],
  'lib-f:test': [{ kind: 'input-file', file: 'libs/a/src/x.ts', pattern: 'libs/a/**/*' }],
})

const owned = setOf(
  [
    { task: 'lib-a:build', reasons: [reason('changed-input', 'libs/a/src/x.ts')] },
    { task: 'lib-g:build', reasons: [reason('dependent-task', null), reason('global-config', 'nx.json')] },
    { task: 'lib-h:build', reasons: [reason('dependent-task', null), reason('reachable-from-entry', 'libs/a/src/x.ts')] },
  ],
  [
    { task: 'lib-b:build', reasons: [reason('unreachable', 'libs/a/src/x.ts'), reason('dependent-task', null)] },
    { task: 'lib-c:build', reasons: [reason('unreachable', 'libs/a/src/x.ts')] },
    { task: 'lib-d:build', reasons: [reason('role-irrelevant', 'libs/a/src/x.ts')] },
    { task: 'lib-i:build', reasons: [reason('unreachable', 'libs/a/src/x.ts')] },
  ]
)

const compared = compareTarget(explanation, owned)

/**
 * The comparison of one task.
 *
 * @param task - The task id
 * @returns Its comparison
 */
function of(task: string) {
  return compared.tasks.find((item) => item.task === task)
}

describe('compareTarget', () => {
  it('lists every task either side knows, sorted', () => {
    expect(compared.tasks.map((task) => task.task)).toEqual([
      'lib-a:build',
      'lib-b:build',
      'lib-c:build',
      'lib-d:build',
      'lib-e:build',
      'lib-g:build',
      'lib-h:build',
      'lib-i:build',
    ])
  })

  it('counts the tasks Nx and the owned analysis selected for the target alone', () => {
    expect([compared.target, compared.nxSelected, compared.ownedSelected]).toEqual(['build', 5, 3])
  })

  it('agrees when both selected the task', () => {
    expect(of('lib-a:build')).toEqual({
      task: 'lib-a:build',
      verdict: Verdict.Agree,
      nx: explanation.affected['lib-a:build'],
      owned: [reason('changed-input', 'libs/a/src/x.ts')],
      unanswered: [],
      rules: ['changed-input'],
      documented: false,
    })
  })

  it('explains a narrower decision with the skip reason answering each file Nx cites, once', () => {
    expect(of('lib-b:build')).toEqual({
      task: 'lib-b:build',
      verdict: Verdict.NarrowerExplained,
      nx: explanation.affected['lib-b:build'],
      owned: [reason('unreachable', 'libs/a/src/x.ts')],
      unanswered: [],
      rules: ['unreachable'],
      documented: false,
    })
  })

  it('leaves a narrower decision unexplained when an Nx reason names no file', () => {
    expect(of('lib-c:build')).toMatchObject({
      verdict: Verdict.NarrowerUnexplained,
      unanswered: [{ kind: 'npm-package', package: 'npm:left-pad' }],
      rules: ['unreachable'],
    })
  })

  it('leaves a narrower decision unexplained when the owned skip has no reason for the file Nx cites', () => {
    expect(of('lib-d:build')).toMatchObject({
      verdict: Verdict.NarrowerUnexplained,
      owned: [],
      unanswered: explanation.affected['lib-d:build'],
      rules: [],
    })
  })

  it('reports a task Nx selected that the owned graph does not have', () => {
    expect(of('lib-e:build')).toMatchObject({ verdict: Verdict.NxOnly, unanswered: explanation.affected['lib-e:build'], owned: [] })
  })

  it('marks a wider selection documented when it rests on dependent tasks and global configuration alone', () => {
    expect(of('lib-g:build')).toMatchObject({ verdict: Verdict.Wider, documented: true, rules: ['dependent-task', 'global-config'] })
  })

  it('marks a wider selection undocumented when another rule fired', () => {
    expect(of('lib-h:build')).toMatchObject({
      verdict: Verdict.Wider,
      documented: false,
      rules: ['dependent-task', 'reachable-from-entry'],
    })
  })

  it('records a task both sides skipped', () => {
    expect(of('lib-i:build')).toEqual({
      task: 'lib-i:build',
      verdict: Verdict.BothSkipped,
      nx: [],
      owned: [],
      unanswered: [],
      rules: [],
      documented: false,
    })
  })

  it('counts every verdict', () => {
    expect(compared.counts).toEqual({
      agree: 1,
      'both-skipped': 1,
      'narrower-explained': 1,
      wider: 2,
      'narrower-unexplained': 2,
      'nx-only': 1,
    })
  })

  it('ignores the tasks of other targets in the explanation', () => {
    expect(compared.tasks.some((task) => task.task === 'lib-f:test')).toBe(false)
  })
})

describe('compareTargets', () => {
  it('compares the targets the owned analysis decided, in the order asked, and skips the rest', () => {
    const sets = new Map([['build', owned]])
    expect(compareTargets(explanation, sets, ['test', 'build']).map((target) => target.target)).toEqual(['build'])
  })
})

const range: RangeComparison = {
  label: 'merge-1',
  base: 'b',
  head: 'h',
  lockfileSkew: false,
  changedFiles: 1,
  targets: [compared],
}

describe('tasksUnder', () => {
  it('returns the tasks of a range under one verdict', () => {
    expect(tasksUnder(range, Verdict.Wider).map((task) => task.task)).toEqual(['lib-g:build', 'lib-h:build'])
  })
})

describe('totalCounts', () => {
  it('adds the counts of every range and target', () => {
    expect(totalCounts([range, range])).toEqual({
      agree: 2,
      'both-skipped': 2,
      'narrower-explained': 2,
      wider: 4,
      'narrower-unexplained': 4,
      'nx-only': 2,
    })
  })
})

describe('sampleRebuilds', () => {
  const second = compareTarget(
    explanationOf({
      'lib-p:build': [{ kind: 'input-file', file: 'libs/a/src/x.ts' }],
      'lib-q:build': [{ kind: 'input-file', file: 'libs/a/src/x.ts' }],
      'lib-r:test': [{ kind: 'input-file', file: 'libs/a/src/x.ts' }],
    }),
    setOf(
      [],
      [
        { task: 'lib-p:build', reasons: [reason('unreachable', 'libs/a/src/x.ts')] },
        { task: 'lib-q:build', reasons: [reason('unreachable', 'libs/a/src/x.ts')] },
      ]
    )
  )
  const other: RangeComparison = { ...range, label: 'merge-2', targets: [second] }

  it('takes explained build skips from each range in turn until the count is reached', () => {
    expect(sampleRebuilds([range, other], 3, () => true).map((item) => `${item.label} ${item.task}`)).toEqual([
      'merge-1 lib-b:build',
      'merge-2 lib-p:build',
      'merge-2 lib-q:build',
    ])
  })

  it('takes every distinct task before taking a task again from another range', () => {
    const again: RangeComparison = { ...other, label: 'merge-3' }
    expect(sampleRebuilds([other, again, range], 4, () => true).map((item) => `${item.label} ${item.task}`)).toEqual([
      'merge-2 lib-p:build',
      'merge-1 lib-b:build',
      'merge-2 lib-q:build',
      'merge-3 lib-p:build',
    ])
  })

  it('leaves out the tasks the caller rules ineligible', () => {
    expect(sampleRebuilds([range, other], 5, (task) => task !== 'lib-p:build').map((item) => item.task)).toEqual([
      'lib-b:build',
      'lib-q:build',
    ])
  })

  it('carries the range revisions on each candidate', () => {
    expect(sampleRebuilds([other], 1, () => true)).toEqual([{ label: 'merge-2', base: 'b', head: 'h', task: 'lib-p:build' }])
  })

  it('does not sample a test task', () => {
    const tests = compareTarget(explanationOf({ 'lib-r:test': [{ kind: 'input-file', file: 'libs/a/src/x.ts' }] }), {
      ...setOf([], [{ task: 'lib-r:test', reasons: [reason('unreachable', 'libs/a/src/x.ts')] }]),
      target: 'test',
    })
    expect(sampleRebuilds([{ ...range, targets: [tests] }], 1, () => true)).toEqual([])
  })
})
