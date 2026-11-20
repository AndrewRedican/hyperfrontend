import type { WorkspaceGraph } from '../build'
import type { AffectedSet, ChangeSet, ChangeStatus } from '../selection'
import type { BaseTsconfig } from './aliases'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { ALIAS_TSCONFIG, createAliasWorkspace } from '../__test-utils__/alias-workspace'
import { workspaceGraph } from '../build'
import { selectAffected } from './select'

/** The targets of the alias workspace. */
const TARGETS = ['build', 'test', 'pack', 'notes', 'docs']

/** Every task of the alias workspace, by target. */
const EVERY_TASK = {
  build: ['lib-data:build', 'lib-plain:build', 'lib-report:build', 'lib-site:build'],
  test: ['lib-data:test', 'lib-kit:test', 'lib-plain:test', 'lib-report:test', 'lib-site:test'],
  pack: ['lib-plain:pack'],
  notes: ['lib-report:notes', 'lib-site:notes'],
  docs: ['root:docs'],
}

/** The base tsconfig as it stood before `@fixture/data/csv` was pointed where the workspace has it. */
const CSV_ELSEWHERE: BaseTsconfig = {
  compilerOptions: {
    ...ALIAS_TSCONFIG.compilerOptions,
    paths: { ...ALIAS_TSCONFIG.compilerOptions.paths, '@fixture/data/csv': ['libs/data/src/csv.ts'] },
  },
}

const graph = workspaceGraph(createAliasWorkspace())

/**
 * The decisions a change to the base tsconfig comes to.
 *
 * @param previousBaseTsconfig - The file at the base, or undefined to leave it out
 * @param of - The graph at the head
 * @param status - What happened to the file
 * @returns The affected set of each target
 */
function decided(
  previousBaseTsconfig: BaseTsconfig | undefined,
  of: WorkspaceGraph = graph,
  status: ChangeStatus = 'modified'
): Map<string, AffectedSet> {
  const changes: ChangeSet = { base: 'base', head: null, changes: [{ status, path: 'tsconfig.base.json', previousPath: null }] }
  return selectAffected({ graph: of, changes, targets: TARGETS, previousBaseTsconfig })
}

/**
 * The tasks selected, by target.
 *
 * @param sets - The affected set of each target
 * @returns The selected task ids of each target
 */
function selected(sets: Map<string, AffectedSet>): Record<string, string[]> {
  return fromEntries(TARGETS.map((target) => [target, (sets.get(target) as AffectedSet).selected.map((decision) => decision.task)]))
}

/**
 * The rules one task's decision rests on.
 *
 * @param sets - The affected set of each target
 * @param task - The task id
 * @returns The reasons of the selected or skipped decision
 */
function reasonsOf(sets: Map<string, AffectedSet>, task: string): unknown {
  const set = sets.get(task.slice(task.indexOf(':') + 1)) as AffectedSet
  return [...set.selected, ...set.skipped].find((decision) => decision.task === task)?.reasons
}

describe('a changed tsconfig.base.json judged alias by alias', () => {
  it('selects the tasks reading a file that imports through the alias: by their own files, their dependencies, a named project or a tool', () => {
    expect(selected(decided(CSV_ELSEWHERE))).toEqual({
      build: EVERY_TASK.build,
      test: ['lib-kit:test', 'lib-report:test', 'lib-site:test'],
      pack: ['lib-plain:pack'],
      notes: [],
      docs: ['root:docs'],
    })
  })

  it('names the alias, the file read and its import', () => {
    expect(reasonsOf(decided(CSV_ELSEWHERE), 'lib-site:test')).toEqual([
      {
        rule: 'alias-changed',
        file: 'tsconfig.base.json',
        path: ['file:libs/report/src/index.ts'],
        message:
          'tsconfig.base.json changed the alias @fixture/data/csv; lib-site:test reads libs/report/src/index.ts, which imports @fixture/data/csv',
      },
    ])
  })

  it('skips a task reading no such file, naming the file', () => {
    expect(reasonsOf(decided(CSV_ELSEWHERE), 'lib-data:test')).toEqual([
      {
        rule: 'same-aliases',
        file: 'tsconfig.base.json',
        path: [],
        message: 'tsconfig.base.json changed only in its path aliases, and no file lib-data:test reads imports through one that differs',
      },
    ])
  })

  it('still selects the tasks of the project the file configures, as any of its configuration does', () => {
    expect(reasonsOf(decided(CSV_ELSEWHERE), 'root:docs')).toEqual([expect.objectContaining({ rule: 'project-configuration' })])
  })

  it('selects only those when the aliases are as they were', () => {
    expect(selected(decided(ALIAS_TSCONFIG))).toEqual({ build: [], test: [], pack: [], notes: [], docs: ['root:docs'] })
  })
})

describe('a changed tsconfig.base.json that selects everything', () => {
  it.each([
    ['its content at the base is not given', undefined, graph, 'modified'],
    ['a compiler option differs', { compilerOptions: { ...ALIAS_TSCONFIG.compilerOptions, strict: false } }, graph, 'modified'],
    ['it was added', CSV_ELSEWHERE, graph, 'added'],
    ['it does not parse at the head', CSV_ELSEWHERE, workspaceGraph(createAliasWorkspace(`${stringify(ALIAS_TSCONFIG)} {`)), 'modified'],
  ] as const)('does so when %s', (_title, previousBaseTsconfig, of, status) => {
    expect(selected(decided(previousBaseTsconfig, of, status))).toEqual(EVERY_TASK)
  })

  it('gives the global rule as the reason', () => {
    expect(reasonsOf(decided(undefined), 'lib-data:test')).toEqual([
      expect.objectContaining({ rule: 'global-config', file: 'tsconfig.base.json' }),
    ])
  })
})
