import type { AffectedSet } from '../selection'
import { describe, expect, it } from '@hyperfrontend/testing'
import { describeReason, formatAffected, formatTask } from './explain'

const set: AffectedSet = {
  target: 'build',
  changes: {
    base: '0123456789abcdef',
    head: null,
    changes: [{ status: 'modified', path: 'libs/a/src/x.ts', previousPath: null }],
  },
  selected: [{ task: 'lib-a:build', reasons: [{ rule: 'changed-input', file: 'libs/a/src/x.ts', path: [], message: 'it is an input' }] }],
  skipped: [
    {
      task: 'lib-b:build',
      reasons: [
        { rule: 'unreachable', file: 'libs/a/src/x.ts', path: ['file:libs/b/src/y.ts', 'file:libs/a/src/x.ts'], message: 'not reached' },
      ],
    },
  ],
  fallbacks: [
    { rule: 'parse-failure', file: 'libs/c/src/z.ts', path: ['file:libs/c/src/z.ts', 'project:lib-c'], message: 'does not parse' },
  ],
}

describe('describeReason', () => {
  it('writes the rule, the file and the sentence, then the path when there is one', () => {
    expect(describeReason(set.skipped[0]?.reasons[0] as never)).toEqual([
      'unreachable libs/a/src/x.ts: not reached',
      '  via file:libs/b/src/y.ts → file:libs/a/src/x.ts',
    ])
  })

  it('leaves the file out of a reason without one', () => {
    expect(describeReason({ rule: 'dependent-task', file: null, path: [], message: 'runs after' })).toEqual(['dependent-task: runs after'])
  })
})

describe('formatAffected', () => {
  it('prints the selected task ids alone in tasks mode', () => {
    expect(formatAffected(set, 'tasks')).toEqual(['lib-a:build'])
  })

  it('prints the heading, the selected and skipped tasks with their reasons, and the fallbacks', () => {
    expect(formatAffected(set, 'explain')).toEqual([
      'build: 1 of 2 tasks selected, 1 changed files, 0123456789ab → working tree',
      '  lib-a:build',
      '      changed-input libs/a/src/x.ts: it is an input',
      'skipped 1 tasks',
      '  lib-b:build',
      '      unreachable libs/a/src/x.ts: not reached',
      '        via file:libs/b/src/y.ts → file:libs/a/src/x.ts',
      'fallbacks (1)',
      '  parse-failure libs/c/src/z.ts: does not parse',
      '    via file:libs/c/src/z.ts → project:lib-c',
    ])
  })

  it('names the head revision and leaves out the empty sections', () => {
    const bare: AffectedSet = { ...set, changes: { ...set.changes, head: 'fedcba9876543210' }, skipped: [], fallbacks: [] }
    expect(formatAffected(bare, 'explain')).toEqual([
      'build: 1 of 1 tasks selected, 1 changed files, 0123456789ab → fedcba987654',
      '  lib-a:build',
      '      changed-input libs/a/src/x.ts: it is an input',
    ])
  })
})

describe('formatTask', () => {
  it('explains a selected task', () => {
    expect(formatTask(set, 'lib-a:build')).toEqual(['lib-a:build is selected', '    changed-input libs/a/src/x.ts: it is an input'])
  })

  it('explains a skipped task', () => {
    expect(formatTask(set, 'lib-b:build')).toEqual([
      'lib-b:build is skipped',
      '    unreachable libs/a/src/x.ts: not reached',
      '      via file:libs/b/src/y.ts → file:libs/a/src/x.ts',
    ])
  })

  it('says when the target has no such task', () => {
    expect(formatTask(set, 'lib-z:build')).toEqual(['lib-z:build is not a task of build'])
  })
})
