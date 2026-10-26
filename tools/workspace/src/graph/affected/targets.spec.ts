import type { ProjectRecord } from '../model'
import { rmSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from '../__test-utils__/workspace'
import { workspaceGraph } from '../build'
import { fileFilterOf, relevantKinds, roleFilterOf, taskInputs } from './targets'

const root = createGraphWorkspace()
const graph = workspaceGraph(root)
const libA = graph.projects.get('lib-a') as ProjectRecord

/**
 * A project of the fixture workspace with the given build inputs.
 *
 * @param inputs - The inputs of its build target
 * @returns The record
 */
function withInputs(inputs: readonly unknown[]): ProjectRecord {
  return { ...libA, configuration: { targets: { build: { inputs } } } }
}

describe('relevantKinds', () => {
  it('leaves type out for the targets that strip types', () => {
    expect([relevantKinds('test').has('type'), relevantKinds('lint').has('type'), relevantKinds('build').has('type')]).toEqual([
      false,
      false,
      true,
    ])
  })
})

describe('roleFilterOf', () => {
  it('excludes specs and test and lint configuration under the production exclusions, and nothing otherwise', () => {
    const production = roleFilterOf(['{projectRoot}/**/*', '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'])
    const everything = roleFilterOf(['{projectRoot}/**/*'])
    expect([
      production('spec'),
      production('test-config'),
      production('lint-config'),
      production('production'),
      everything('spec'),
    ]).toEqual([false, false, false, true, true])
  })
})

describe('fileFilterOf', () => {
  it('matches the positive patterns with the placeholders replaced', () => {
    const filter = fileFilterOf(['{projectRoot}/src/**/*', '{workspaceRoot}/lint.config.ts'], 'libs/a')
    expect([
      filter('libs/a/src/x.ts', 'production'),
      filter('lint.config.ts', 'lint-config'),
      filter('libs/b/src/x.ts', 'production'),
    ]).toEqual([true, true, false])
  })

  it('applies a negative pattern the compiler reads and leaves an extended glob unapplied', () => {
    const filter = fileFilterOf(['{projectRoot}/**/*', '!{projectRoot}/**/*.md', '!{projectRoot}/**/+(docs)/*'], 'libs/a')
    expect([filter('libs/a/README.md', 'docs'), filter('libs/a/docs/x.ts', 'production')]).toEqual([false, true])
  })

  it('reads the production exclusions by role', () => {
    const filter = fileFilterOf(['{projectRoot}/**/*', '!{projectRoot}/test.config.ts'], 'libs/a')
    expect([
      filter('libs/a/test.config.ts', 'test-config'),
      filter('libs/a/src/a.spec.ts', 'spec'),
      filter('libs/a/src/a.ts', 'production'),
    ]).toEqual([false, false, true])
  })

  it('treats the workspace root project as owning paths without a prefix', () => {
    expect(fileFilterOf(['{projectRoot}/**/*'], '.')('docs/guide.md', 'docs')).toBe(true)
  })
})

describe('taskInputs', () => {
  it('reads the dependency filter from the ^ input and the named projects with their input', () => {
    const inputs = taskInputs(root, libA, 'build')
    const dependency = inputs.dependencies?.('libs/b')
    expect({
      dependencies: [
        dependency?.('libs/b/src/x.spec.ts', 'spec'),
        dependency?.('libs/b/src/x.ts', 'production'),
        dependency?.('libs/c/x.ts', 'production'),
      ],
      projects: inputs.projects.map((input) => `${input.project} ${input.files('libs/b')('libs/b/src/x.spec.ts', 'spec')}`),
      kinds: inputs.kinds.size,
    }).toEqual({ dependencies: [false, true, false], projects: ['@fixture/b false'], kinds: 10 })
  })

  it('answers no dependency filter for a target reading no dependency input', () => {
    expect(taskInputs(root, libA, 'lint').dependencies).toBeNull()
  })

  it('reads the object forms of a dependency input and a projects list', () => {
    const inputs = taskInputs(
      root,
      withInputs([
        { input: 'production', dependencies: true },
        { fileset: '{projectRoot}/x', dependencies: true },
        { projects: ['root', '@fixture/b'] },
      ]),
      'build'
    )
    expect({
      spec: inputs.dependencies?.('libs/b')('libs/b/src/x.spec.ts', 'spec'),
      projects: inputs.projects.map((input) => `${input.project} ${input.files('libs/b')('libs/b/src/x.spec.ts', 'spec')}`),
    }).toEqual({ spec: true, projects: ['root true', '@fixture/b true'] })
  })

  it('starts a build closure from production files alone and a test closure from every input', () => {
    const build = taskInputs(root, libA, 'build')
    const test = taskInputs(root, libA, 'test')
    expect([
      build.reach('libs/a/src/a.spec.ts', 'spec'),
      build.reach('libs/a/src/a.ts', 'production'),
      test.reach('libs/a/src/a.spec.ts', 'spec'),
    ]).toEqual([false, true, true])
  })

  it('keys tasks reading the same own files alike and build apart from the rest', () => {
    const [build, typecheck, test] = [
      taskInputs(root, libA, 'build').key,
      taskInputs(root, libA, 'typecheck').key,
      taskInputs(root, libA, 'test').key,
    ]
    expect([build === typecheck, typecheck === test]).toEqual([false, false])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(graph.projects.has('lib-a')).toBe(true)
  })
})
