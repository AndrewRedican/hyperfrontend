import type { ProjectRecord } from '../model'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  aliasChanged,
  changedInput,
  configurationKind,
  dependentTask,
  fallback,
  globalConfig,
  isGlobalConfig,
  reached,
  sameAliases,
  skipped,
} from './rules'

const lib: ProjectRecord = {
  name: 'lib-a',
  root: 'libs/a',
  type: 'lib',
  tags: [],
  implicitDependencies: [],
  files: [],
  manifest: null,
  configuration: null,
}
const root: ProjectRecord = { ...lib, name: 'root', root: '.' }

describe('isGlobalConfig', () => {
  it('names the four files whose change invalidates everything', () => {
    expect(
      ['hf.json', 'package.json', 'package-lock.json', 'tsconfig.base.json', 'libs/a/package.json', 'lint.base.config.ts'].map(
        isGlobalConfig
      )
    ).toEqual([true, true, true, true, false, false])
  })
})

describe('configurationKind', () => {
  it.each([
    ['libs/a/package.json', lib, 'manifest'],
    ['libs/a/project.json', lib, 'configuration'],
    ['libs/a/tsconfig.spec.json', lib, 'configuration'],
    ['libs/a/test.config.ts', lib, 'configuration'],
    ['libs/a/lint.config.ts', lib, 'configuration'],
    ['libs/a/src/index.ts', lib, null],
    ['libs/a/src/package.json', lib, null],
    ['project.json', root, 'configuration'],
    ['docs/guide.md', root, null],
  ])('classifies %s', (path, project, kind) => {
    expect(configurationKind(path, project)).toBe(kind)
  })
})

describe('the reasons of a change to the path aliases', () => {
  it('name the alias, the file read and its import for a task selected', () => {
    expect(aliasChanged('tsconfig.base.json', 'lib-a:test', '@fixture/b/csv', 'libs/a/src/x.ts', '@fixture/b/csv')).toEqual({
      rule: 'alias-changed',
      file: 'tsconfig.base.json',
      path: ['file:libs/a/src/x.ts'],
      message: 'tsconfig.base.json changed the alias @fixture/b/csv; lib-a:test reads libs/a/src/x.ts, which imports @fixture/b/csv',
    })
  })

  it('name the file for a task left out', () => {
    expect(sameAliases('tsconfig.base.json', 'lib-a:test')).toEqual({
      rule: 'same-aliases',
      file: 'tsconfig.base.json',
      path: [],
      message: 'tsconfig.base.json changed only in its path aliases, and no file lib-a:test reads imports through one that differs',
    })
  })
})

describe('the reason constructors', () => {
  it('write one sentence each with the rule, the file and the path', () => {
    expect([
      globalConfig('hf.json', 'lib-a:build'),
      changedInput('libs/a/src/x.ts', 'lib-a:build', 'production file of lib-a'),
      reached('cycle', 'libs/b/src/x.ts', 'lib-a:build', ['file:a', 'file:b'], 'lib-b is in a cycle'),
      dependentTask('e2e-a:e2e', 'lib-a:build'),
      skipped('unreachable', 'libs/b/src/x.ts', 'lib-a:build', 'lib-a does not depend on lib-b'),
      fallback('parse-failure', 'libs/b/src/x.ts', ['file:x', 'project:lib-b'], 'libs/b/src/x.ts does not parse'),
    ]).toEqual([
      { rule: 'global-config', file: 'hf.json', path: [], message: 'hf.json changed, which invalidates every task; lib-a:build runs' },
      {
        rule: 'changed-input',
        file: 'libs/a/src/x.ts',
        path: [],
        message: 'libs/a/src/x.ts is an input of lib-a:build (production file of lib-a)',
      },
      {
        rule: 'cycle',
        file: 'libs/b/src/x.ts',
        path: ['file:a', 'file:b'],
        message: 'libs/b/src/x.ts reaches lib-a:build: lib-b is in a cycle',
      },
      { rule: 'dependent-task', file: null, path: ['task:lib-a:build'], message: 'e2e-a:e2e runs after lib-a:build, which is selected' },
      {
        rule: 'unreachable',
        file: 'libs/b/src/x.ts',
        path: [],
        message: 'libs/b/src/x.ts does not reach lib-a:build: lib-a does not depend on lib-b',
      },
      { rule: 'parse-failure', file: 'libs/b/src/x.ts', path: ['file:x', 'project:lib-b'], message: 'libs/b/src/x.ts does not parse' },
    ])
  })
})
