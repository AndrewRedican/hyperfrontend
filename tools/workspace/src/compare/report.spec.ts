import type { Reason } from '../graph/selection'
import type { RangeComparison, TargetComparison, TaskComparison } from './classify'
import type { ComparisonReport } from './report'
import { describe, expect, it } from '@hyperfrontend/testing'
import { Verdict } from './classify'
import { describeNxReason, renderReport } from './report'

/**
 * The parts of a list a text lacks.
 *
 * @param text - The text searched
 * @param parts - The fragments expected in it
 * @returns The fragments not found, none when every one is present
 */
function missing(text: string, parts: readonly string[]): string[] {
  return parts.filter((part) => !text.includes(part))
}

/**
 * The parts of a list a text holds.
 *
 * @param text - The text searched
 * @param parts - The fragments expected to be absent
 * @returns The fragments found, none when every one is absent
 */
function present(text: string, parts: readonly string[]): string[] {
  return parts.filter((part) => text.includes(part))
}

/**
 * A reason with an empty path.
 *
 * @param rule - The rule the reason rests on
 * @param file - The changed file it starts from, or null
 * @param message - The sentence a reader sees
 * @returns The reason record
 */
function reason(rule: Reason['rule'], file: string | null, message: string): Reason {
  return { rule, file, path: [], message }
}

/**
 * A task comparison with the given verdict.
 *
 * @param task - The task id
 * @param verdict - How the task's two decisions compare
 * @param rest - The fields that differ from the defaults
 * @returns The comparison record, empty reasons unless given
 */
function task(task: string, verdict: Verdict, rest: Partial<TaskComparison> = {}): TaskComparison {
  return { task, verdict, nx: [], owned: [], unanswered: [], rules: [], documented: false, ...rest }
}

const build: TargetComparison = {
  target: 'build',
  nxSelected: 4,
  ownedSelected: 3,
  tasks: [
    task('lib-a:build', Verdict.Agree, { rules: ['changed-input'] }),
    task('lib-b:build', Verdict.NarrowerExplained, {
      owned: [reason('unreachable', 'libs/a/src/x.ts', 'depends on lib-a only through value spec (1 file)')],
      rules: ['unreachable'],
    }),
    task('lib-c:build', Verdict.NarrowerExplained, {
      owned: [reason('unreachable', 'libs/a/src/x.ts', 'not reachable'), reason('kind-irrelevant', 'libs/a/src/t.ts', 'type-only')],
      rules: ['kind-irrelevant', 'unreachable'],
    }),
    task('lib-d:build', Verdict.NarrowerUnexplained, {
      unanswered: [{ kind: 'npm-package', package: 'npm:left-pad', file: 'package.json' }],
      owned: [reason('unreachable', 'libs/a/src/x.ts', 'not reachable')],
      rules: ['unreachable'],
    }),
    task('lib-e:build', Verdict.Wider, {
      owned: [reason('dependent-task', null, 'runs after lib-a:build | selected')],
      rules: ['dependent-task'],
      documented: true,
    }),
    task('lib-f:build', Verdict.BothSkipped),
    task('lib-g:build', Verdict.Wider, { owned: [reason('changed-input', 'tools/x.ts', 'is an input')], rules: ['changed-input'] }),
  ],
  counts: { agree: 1, 'both-skipped': 1, 'narrower-explained': 2, wider: 1, 'narrower-unexplained': 1, 'nx-only': 0 },
}

const lint: TargetComparison = {
  target: 'lint',
  nxSelected: 2,
  ownedSelected: 0,
  tasks: [task('lib-a:lint', Verdict.NxOnly), task('lib-b:lint', Verdict.NxOnly)],
  counts: { agree: 0, 'both-skipped': 0, 'narrower-explained': 0, wider: 0, 'narrower-unexplained': 0, 'nx-only': 2 },
}

const range: RangeComparison = {
  label: 'merge 1234567890ab',
  base: 'aaaaaaaaaaaaaaaaaaaa',
  head: 'bbbbbbbbbbbbbbbbbbbb',
  lockfileSkew: true,
  changedFiles: 3,
  targets: [build, lint],
}

const report: ComparisonReport = {
  generatedAt: '2026-10-26T00:00:00Z',
  targets: ['build', 'lint'],
  ranges: [range],
  rebuilds: [
    { candidate: { label: range.label, base: range.base, head: range.head, task: 'lib-b:build' }, outcome: 'identical', detail: '' },
    {
      candidate: { label: range.label, base: range.base, head: range.head, task: 'lib-c:build' },
      outcome: 'different',
      detail: 'README.md',
    },
    {
      candidate: { label: range.label, base: range.base, head: range.head, task: 'lib-d:build' },
      outcome: 'skipped',
      detail: 'no such project at the base',
    },
  ],
  notes: ['The lint tasks are inferred.'],
}

describe('describeNxReason', () => {
  it('writes the kind, the file and whatever else the reason carries', () => {
    expect(describeNxReason({ kind: 'input-file', file: 'a.ts', pattern: 'libs/**', package: 'npm:x', producer: 'lib-a:build' })).toBe(
      'input-file a.ts matching libs/** package npm:x from lib-a:build'
    )
  })

  it('says when the reason names no file', () => {
    expect(describeNxReason({ kind: 'moved-ecosystem' })).toBe('moved-ecosystem (no file)')
  })
})

describe('renderReport', () => {
  const text = renderReport(report)

  it('opens with the totals and the verdict on category (c)', () => {
    expect(text).toContain(
      [
        '| Agree | (a) | (b) | (b) documented | (c) | Nx only | Both skipped |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| 1 | 2 | 1 | 1 of 2 | 1 | 2 | 1 |',
        '',
        '**1 category (c) task.** Listed below with the Nx reasons left unanswered.',
      ].join('\n')
    )
  })

  it('writes one row per range and target, with the skew marked', () => {
    expect(
      missing(text, [
        '| merge 1234567890ab (aaaaaaaaaaaa → bbbbbbbbbbbb) ⚠ lock-file skew | 3 | build | 4 | 3 | 1 | 2 | 1 | 1 | 0 |',
        '| merge 1234567890ab (aaaaaaaaaaaa → bbbbbbbbbbbb) ⚠ lock-file skew | 3 | lint | 2 | 0 | 0 | 0 | 0 | 0 | 2 |',
      ])
    ).toEqual([])
  })

  it('lists each category (c) task with its unanswered and answered reasons', () => {
    expect(text).toContain(
      [
        '- **lib-d:build** in merge 1234567890ab (aaaaaaaaaaaa → bbbbbbbbbbbb) ⚠ lock-file skew',
        '  - unanswered: npm-package package.json package npm:left-pad',
        '  - answered: unreachable libs/a/src/x.ts: not reachable',
      ].join('\n')
    )
  })

  it('tables the wider tasks with pipes escaped, documented or not', () => {
    expect(
      missing(text, [
        '| lib-e:build | dependent-task | yes | runs after lib-a:build \\| selected |',
        '| lib-g:build | changed-input | no | is an input |',
      ])
    ).toEqual([])
  })

  it('counts the explained skips by rule with an example each', () => {
    expect(
      missing(text, [
        '| kind-irrelevant | 1 | lib-c:build: type-only |',
        '| unreachable | 2 | lib-b:build: depends on lib-a only through value spec (1 file) |',
      ])
    ).toEqual([])
  })

  it('counts the tasks Nx alone knows by target', () => {
    expect(text).toContain('| lint | 2 | lib-a:lint |')
  })

  it('tables the rebuilds under their tally', () => {
    expect(
      missing(text, [
        '1 of 3 rebuilt tasks produced byte-identical output at both revisions.',
        '| merge 1234567890ab | lib-c:build | different | README.md |',
      ])
    ).toEqual([])
  })

  it('lists the skewed ranges and the notes', () => {
    expect(
      missing(text, [
        '## Lock-file skew',
        '- merge 1234567890ab (aaaaaaaaaaaa → bbbbbbbbbbbb) ⚠ lock-file skew',
        '## Notes\n\nThe lint tasks are inferred.\n',
      ])
    ).toEqual([])
  })

  it('says none under every empty section and leaves skew and notes out', () => {
    const clean = renderReport({
      generatedAt: 'now',
      targets: ['build'],
      ranges: [
        {
          ...range,
          lockfileSkew: false,
          targets: [
            {
              ...build,
              tasks: [build.tasks[0] as TaskComparison],
              counts: { agree: 1, 'both-skipped': 0, 'narrower-explained': 0, wider: 0, 'narrower-unexplained': 0, 'nx-only': 0 },
            },
          ],
        },
      ],
      rebuilds: [],
      notes: [],
    })
    expect([
      missing(clean, [
        '**No category (c) task.**',
        '## Category (c): narrower without a reason\n\nNone.\n',
        '## Category (b): wider\n\nNone.\n',
        '## Category (a): narrower with a reason, by rule\n\nNone.\n',
        '## Tasks Nx alone knows\n\nNone.\n',
        '## Rebuilds of skipped build tasks\n\nNone run.\n',
      ]),
      present(clean, ['## Lock-file skew', '## Notes']),
    ]).toEqual([[], []])
  })

  it('counts a plural number of category (c) tasks', () => {
    const two = renderReport({ ...report, ranges: [range, range] })
    expect(missing(two, ['**2 category (c) tasks.**', '2 ranges, targets build, lint.'])).toEqual([])
  })
})
