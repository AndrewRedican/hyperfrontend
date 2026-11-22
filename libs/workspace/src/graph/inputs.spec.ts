import type { ProjectRecord } from './model'
import { existsSync, rmSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createGraphWorkspace } from './__test-utils__/workspace'
import {
  expandWith,
  isCompatibleTarget,
  readWorkspaceFile,
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

describe('readWorkspaceFile', () => {
  it('reads hf.json once per root', () => {
    expect(readWorkspaceFile(root)).toBe(readWorkspaceFile(root))
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

  it('refuses inputs of the project that hold an entry that is not an input, naming the task', () => {
    expect(() => targetInputs(root, withInputs(['default', null]), 'build')).toThrow(
      'the input list of lib-a:build holds null, which is not an input: a string, or an object whose fileset or input is a string'
    )
  })

  it('refuses inputs of the defaults that are not a list, naming the task that reads them', () => {
    const malformed = createTempDir({
      prefix: 'inputs-malformed-',
      tree: { 'hf.json': '{ "targetDefaults": { "build": { "inputs": "production" } } }' },
    })
    try {
      expect(() => targetInputs(malformed.path, withInputs(undefined), 'build')).toThrow(
        'the input list of lib-a:build is "production", which is not a list of inputs'
      )
    } finally {
      malformed.remove()
    }
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
  const run = { executor: '@hyperfrontend/workspace:run-commands', options: { command: 'npm audit' } }

  it('treats run-commands targets as the same target only when their commands agree or one names none', () => {
    expect([
      isCompatibleTarget({ executor: '@hyperfrontend/workspace:run-commands' }, run),
      isCompatibleTarget({ executor: '@hyperfrontend/workspace:run-commands', options: { command: 'npm audit' } }, run),
      isCompatibleTarget({ executor: '@hyperfrontend/workspace:run-commands', options: { commands: ['npm', 'audit'] } }, run),
      isCompatibleTarget({ executor: '@hyperfrontend/workspace:run-commands', options: { command: 'npm test' } }, run),
    ]).toEqual([true, true, false, false])
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
      { value: '@hyperfrontend/workspace:run-commands', from: 'project' },
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

  it('falls back to the default input without hf.json', () => {
    const bare = createTempDir({ prefix: 'inputs-bare-', tree: {} })
    try {
      expect(selfInputs(bare.path, withInputs(undefined), 'build')).toEqual(['{projectRoot}/**/*'])
    } finally {
      bare.remove()
    }
  })
})

describe('expandWith', () => {
  /**
   * The patterns of a named input called `watchers`, defined by the workspace file as given.
   *
   * @param watchers - The value the workspace file gives the named input
   * @returns The patterns the named input stands for
   */
  function expandWatchers(watchers: unknown): string[] {
    return expandWith({ namedInputs: { watchers } } as never, lib, ['watchers'])
  }

  it('keeps a name every object inherits as a pattern, and expands nothing for an input that names one', () => {
    expect(expandWatchers(['constructor', { input: 'toString' }, '__proto__', '{projectRoot}/x'])).toEqual([
      'constructor',
      '__proto__',
      '{projectRoot}/x',
    ])
  })

  it('expands a named input whose own name is one every object inherits', () => {
    expect(expandWith({ namedInputs: { constructor: ['{projectRoot}/c/**'] } }, lib, ['constructor', { input: 'constructor' }])).toEqual([
      '{projectRoot}/c/**',
      '{projectRoot}/c/**',
    ])
  })

  it.each([
    ['null', null, 'null'],
    ['a number', 5, '5'],
    ['a boolean', true, 'true'],
    ['a list', ['{projectRoot}/x'], '["{projectRoot}/x"]'],
    ['an object whose fileset is not a string', { fileset: 5, input: 'default' }, '{"fileset":5,"input":"default"}'],
    ['an object whose input is not a string', { input: 5 }, '{"input":5}'],
  ])('refuses %s among the entries of a named input, naming the input', (_, entry, written) => {
    expect(() => expandWatchers(['{projectRoot}/x', entry])).toThrow(
      `named input "watchers" of hf.json holds ${written}, which is not an input: a string, or an object whose fileset or input is a string`
    )
  })

  it.each([
    ['null', null, 'null'],
    ['a number', 5, '5'],
    ['a string', '{projectRoot}/x', '"{projectRoot}/x"'],
    ['an object', { fileset: '{projectRoot}/x' }, '{"fileset":"{projectRoot}/x"}'],
  ])('refuses a named input written as %s rather than as a list', (_, watchers, written) => {
    expect(() => expandWatchers(watchers)).toThrow(`named input "watchers" of hf.json is ${written}, which is not a list of inputs`)
  })

  it('names the project whose own named input is malformed', () => {
    expect(() => expandWith({ namedInputs: { own: [] } }, withInputs(undefined, { own: [null] }), [{ input: 'own' }])).toThrow(
      'named input "own" of lib-a holds null'
    )
  })

  it('refuses an entry of the list it is handed that is not an input, naming the project', () => {
    expect(() => expandWith({}, lib, [5 as never])).toThrow('the input list expanded for lib-a holds 5, which is not an input')
  })

  it('leaves a malformed named input alone where nothing reads it', () => {
    expect(expandWith({ namedInputs: { watchers: [null] } as never }, lib, ['default'])).toEqual(['{projectRoot}/**/*'])
  })
})

describe('readWorkspaceFile', () => {
  it('reads an hf.json saved with a byte order mark', () => {
    const marked = createTempDir({ prefix: 'inputs-marked-', tree: { 'hf.json': '\uFEFF{ "namedInputs": { "kept": [] } }' } })
    try {
      expect(readWorkspaceFile(marked.path)).toEqual({ namedInputs: { kept: [] } })
    } finally {
      marked.remove()
    }
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
