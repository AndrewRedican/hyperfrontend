import type { ProjectRecord } from './model'
import { existsSync, rmSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createGraphWorkspace } from './__test-utils__/workspace'
import {
  isCompatibleTarget,
  readNxConfiguration,
  selfInputs,
  targetDefaultsFor,
  targetDependsOn,
  targetExecutor,
  targetInputs,
} from './inputs'
import { discoverProjects, listFiles } from './workspace'

const root = createGraphWorkspace()
const projects = discoverProjects(root, listFiles(root))
const lib = projects.get('lib-a') as ProjectRecord

/**
 * A project with the given build inputs and named inputs.
 *
 * @param inputs - The build target's inputs, or undefined for none
 * @param namedInputs - The project's named inputs
 * @returns The project record
 */
function withInputs(inputs: readonly unknown[] | undefined, namedInputs?: Readonly<Record<string, readonly unknown[]>>): ProjectRecord {
  return {
    ...lib,
    configuration: {
      name: 'lib-a',
      targets: { build: inputs === undefined ? {} : { inputs } },
      ...(namedInputs === undefined ? {} : { namedInputs }),
    },
  }
}

describe('readNxConfiguration', () => {
  it('reads nx.json once per root', () => {
    expect(readNxConfiguration(root)).toBe(readNxConfiguration(root))
  })
})

describe('targetInputs', () => {
  it('prefers the project, then the defaults, then the implicit default', () => {
    expect([targetInputs(root, lib, 'test').from, targetInputs(root, lib, 'build').from, targetInputs(root, lib, 'version')]).toEqual([
      'project',
      'defaults',
      { value: ['default', '^default'], from: 'implicit' },
    ])
  })
})

/**
 * The library with its build target written as given.
 *
 * @param build - The build target as `project.json` would write it
 * @returns The project record
 */
function withBuild(build: Readonly<Record<string, unknown>>): ProjectRecord {
  return { ...lib, configuration: { name: 'lib-a', targets: { build } } }
}

describe('targetDefaultsFor', () => {
  it('applies the defaults to a target naming the same executor or none', () => {
    expect([
      targetDefaultsFor(root, withBuild({}), 'build')?.executor,
      targetDefaultsFor(root, withBuild({ executor: '@fixture/tooling:build' }), 'build')?.executor,
    ]).toEqual(['@fixture/tooling:build', '@fixture/tooling:build'])
  })

  it('withholds the defaults from a target naming another executor', () => {
    expect([
      targetDefaultsFor(root, withBuild({ executor: '@fixture/other:build' }), 'build'),
      targetInputs(root, withBuild({ executor: '@fixture/other:build' }), 'build'),
      targetExecutor(root, withBuild({ executor: '@fixture/other:build' }), 'build'),
      targetDependsOn(root, withBuild({ executor: '@fixture/other:build' }), 'build'),
    ]).toEqual([null, { value: ['default', '^default'], from: 'implicit' }, { value: '@fixture/other:build', from: 'project' }, []])
  })

  it('answers null for a target without defaults', () => {
    expect(targetDefaultsFor(root, lib, 'version')).toBe(null)
  })
})

describe('isCompatibleTarget', () => {
  const run = { executor: 'nx:run-commands', options: { command: 'npm audit' } }

  it('treats run-commands targets as the same target only when their commands agree or one names none', () => {
    expect([
      isCompatibleTarget({ executor: 'nx:run-commands' }, run),
      isCompatibleTarget({ executor: 'nx:run-commands', options: { command: 'npm audit' } }, run),
      isCompatibleTarget({ executor: 'nx:run-commands', options: { commands: ['npm', 'audit'] } }, run),
      isCompatibleTarget({ executor: 'nx:run-commands', options: { command: 'npm test' } }, run),
    ]).toEqual([true, true, false, false])
  })

  it('compares the scripts of run-script targets', () => {
    expect([
      isCompatibleTarget({ executor: 'nx:run-script', options: { script: 'a' } }, { executor: 'nx:run-script', options: { script: 'a' } }),
      isCompatibleTarget({ executor: 'nx:run-script', options: { script: 'a' } }, { executor: 'nx:run-script', options: { script: 'b' } }),
    ]).toEqual([true, false])
  })

  it('treats any other shared executor as compatible whatever the options', () => {
    expect(
      isCompatibleTarget({ executor: '@fixture/tooling:build', options: { command: 'x' } }, { executor: '@fixture/tooling:build' })
    ).toBe(true)
  })
})

describe('targetExecutor', () => {
  it('prefers the project, then the defaults, and answers null without either', () => {
    expect([targetExecutor(root, lib, 'version'), targetExecutor(root, lib, 'build'), targetExecutor(root, lib, 'lint')]).toEqual([
      { value: 'nx:run-commands', from: 'project' },
      { value: '@fixture/tooling:build', from: 'defaults' },
      null,
    ])
  })
})

describe('selfInputs', () => {
  it('reads the target defaults, leaving out the dependencies and other projects', () => {
    expect(selfInputs(root, lib, 'build')).toEqual(['{projectRoot}/**/*', '{workspaceRoot}/patches/**', '!{projectRoot}/**/*.spec.ts'])
  })

  it('expands the project named inputs and object inputs', () => {
    const project = withInputs(
      [
        'own',
        { input: 'own', projects: 'self' },
        { fileset: '{projectRoot}/x' },
        { fileset: '{projectRoot}/y', dependencies: true },
        { input: 'own', dependencies: true },
        { env: 'X' },
        { input: 'undefined-name' },
        'missing-name',
      ],
      { own: ['{projectRoot}/c/**'] }
    )
    expect(selfInputs(root, project, 'build')).toEqual(['{projectRoot}/c/**', '{projectRoot}/c/**', '{projectRoot}/x', 'missing-name'])
  })

  it('stops expanding a named input that names itself through another', () => {
    const project = withInputs(['a'], { a: ['b', '{projectRoot}/a/**'], b: ['a', '{projectRoot}/b/**'] })
    expect(selfInputs(root, project, 'build')).toEqual(['{projectRoot}/b/**', '{projectRoot}/a/**'])
  })

  it('falls back to the default input without nx.json', () => {
    const bare = createTempDir({ prefix: 'inputs-bare-', tree: {} })
    expect(selfInputs(bare.path, withInputs(undefined), 'build')).toEqual(['{projectRoot}/**/*'])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
