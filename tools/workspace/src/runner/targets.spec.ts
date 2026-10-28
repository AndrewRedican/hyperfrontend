import type { NxJsonConfiguration } from '@hyperfrontend/integration-nx/compat'
import type { ProjectConfiguration, ProjectRecord } from '../graph/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  defaultsFor,
  desugar,
  executorOf,
  interpolate,
  mergeTarget,
  parseTaskId,
  projectTargets,
  resolveTarget,
  RUN_COMMANDS,
} from './targets'

/**
 * A project record.
 *
 * @param configuration - Its `project.json`, or null for a manifest-only project
 * @returns A library at `libs/alpha` named `lib-alpha`
 */
function project(configuration: ProjectConfiguration | null): ProjectRecord {
  return {
    name: 'lib-alpha',
    root: 'libs/alpha',
    type: 'lib',
    tags: [],
    implicitDependencies: [],
    files: [],
    manifest: null,
    configuration,
  }
}

/** A workspace configuration with defaults keyed by name and by executor. */
const NX: NxJsonConfiguration = {
  targetDefaults: {
    build: { executor: '@fixture/tooling:build', options: { outputPath: 'dist/{projectRoot}', mode: 'default' } },
    '@fixture/tooling:check': { options: { level: 'from-executor' } },
    check: { options: { level: 'from-name' } },
    audit: { command: 'npm audit', options: { cwd: '{projectRoot}' } },
  },
}

describe('desugar', () => {
  it('reads a bare command as a run-commands target', () => {
    expect(desugar({ command: 'npm test', options: { cwd: 'libs/a' } }, 'lib-a:test')).toEqual({
      executor: RUN_COMMANDS,
      options: { cwd: 'libs/a', command: 'npm test' },
    })
  })

  it('leaves a target without a command as it is', () => {
    const target = { executor: '@fixture/tooling:build' }
    expect(desugar(target, 'lib-a:build')).toBe(target)
  })

  it('refuses a target naming both an executor and a command', () => {
    expect(() => desugar({ executor: '@fixture/tooling:build', command: 'make' }, 'lib-a:build')).toThrow(
      'lib-a:build names both an executor and a command'
    )
  })
})

describe('defaultsFor', () => {
  it('takes the entry under the executor first', () => {
    expect(defaultsFor(NX, 'check', '@fixture/tooling:check')).toEqual({ options: { level: 'from-executor' } })
  })

  it('takes the entry under the name for a target naming no executor', () => {
    expect(defaultsFor(NX, 'check', undefined)).toEqual({ options: { level: 'from-name' } })
  })

  it('takes the entry under the name when its executor has none', () => {
    expect(defaultsFor(NX, 'build', '@fixture/tooling:build')?.options).toEqual({ outputPath: 'dist/{projectRoot}', mode: 'default' })
  })

  it('reads a bare command of the defaults as a run-commands target', () => {
    expect(defaultsFor(NX, 'audit', undefined)).toEqual({ executor: RUN_COMMANDS, options: { cwd: '{projectRoot}', command: 'npm audit' } })
  })

  it('finds nothing for a target the defaults do not name', () => {
    expect(defaultsFor(NX, 'serve', undefined)).toBe(undefined)
  })

  it('finds nothing in a workspace without defaults', () => {
    expect(defaultsFor({}, 'build', undefined)).toBe(undefined)
  })

  it('refuses defaults keyed by a pattern', () => {
    expect(() => defaultsFor({ targetDefaults: { 'e2e-*': {} } }, 'serve', undefined)).toThrow(
      'nx.json targetDefaults key e2e-* is a pattern, and patterns are not matched against target names'
    )
  })

  it('refuses defaults written as a list of filtered entries', () => {
    expect(() => defaultsFor({ targetDefaults: { build: [{ options: {} }] } }, 'build', undefined)).toThrow(
      'nx.json targetDefaults.build is a list of filtered entries, which are not read'
    )
  })
})

describe('mergeTarget', () => {
  it('leaves the target alone without defaults', () => {
    const own = { executor: 'a:b' }
    expect(mergeTarget(own, undefined)).toBe(own)
  })

  it('lays the target over compatible defaults, its options winning', () => {
    expect(mergeTarget({ options: { mode: 'own' } }, { executor: 'a:b', cache: true, options: { mode: 'default', depth: 1 } })).toEqual({
      executor: 'a:b',
      cache: true,
      options: { mode: 'own', depth: 1 },
    })
  })

  it('drops defaults naming another executor', () => {
    expect(mergeTarget({ executor: 'a:own' }, { executor: 'a:other', options: { mode: 'default' } })).toEqual({ executor: 'a:own' })
  })

  it('drops run-commands defaults running another command', () => {
    expect(
      mergeTarget(
        { executor: RUN_COMMANDS, options: { command: 'own' } },
        { executor: RUN_COMMANDS, options: { command: 'other', cwd: 'x' } }
      )
    ).toEqual({ executor: RUN_COMMANDS, options: { command: 'own' } })
  })

  it('merges run-commands defaults running the same commands', () => {
    expect(
      mergeTarget(
        { executor: RUN_COMMANDS, options: { commands: ['a', 'b'] } },
        { executor: RUN_COMMANDS, options: { commands: ['a', 'b'], cwd: 'x' } }
      ).options
    ).toEqual({ commands: ['a', 'b'], cwd: 'x' })
  })
})

describe('interpolate', () => {
  const alpha = project(null)

  it.each([
    ['{workspaceRoot}/dist/x', 'dist/x'],
    ['{workspaceRoot}', ''],
    ['dist/{projectRoot}/{projectRoot}', 'dist/libs/alpha/libs/alpha'],
    ['{projectName}@', 'lib-alpha@'],
    ['plain', 'plain'],
  ])('reads %j as %j', (text, value) => {
    expect(interpolate(text, alpha, 'options')).toBe(value)
  })

  it('refuses {workspaceRoot} anywhere but at the start', () => {
    expect(() => interpolate({ out: 'dist/{workspaceRoot}' }, alpha, 'lib-alpha:build options')).toThrow(
      'lib-alpha:build options.out uses {workspaceRoot} after its start, where the token is not read'
    )
  })

  it('replaces the tokens of nested objects and lists, leaving other values', () => {
    expect(interpolate({ a: ['{projectRoot}', 1], b: { c: '{projectName}', d: null, e: true } }, alpha, 'options')).toEqual({
      a: ['libs/alpha', 1],
      b: { c: 'lib-alpha', d: null, e: true },
    })
  })
})

describe('resolveTarget', () => {
  it('merges the defaults under the name and replaces the tokens', () => {
    expect(resolveTarget(NX, project(null), 'build', { options: { entry: '{projectRoot}/src/index.ts' } })).toEqual({
      executor: '@fixture/tooling:build',
      options: { outputPath: 'dist/libs/alpha', mode: 'default', entry: 'libs/alpha/src/index.ts' },
    })
  })

  it('gives a target without options or defaults empty options', () => {
    expect(resolveTarget(NX, project(null), 'serve', { executor: 'a:serve' })).toEqual({ executor: 'a:serve', options: {} })
  })
})

describe('projectTargets', () => {
  it('resolves every target the project writes', () => {
    expect(projectTargets(NX, project({ targets: { audit: {}, check: { executor: '@fixture/tooling:check' } } }))).toEqual({
      audit: { executor: RUN_COMMANDS, options: { cwd: 'libs/alpha', command: 'npm audit' } },
      check: { executor: '@fixture/tooling:check', options: { level: 'from-executor' } },
    })
  })

  it('finds no targets in a project without a configuration', () => {
    expect(projectTargets(NX, project(null))).toEqual({})
  })
})

describe('parseTaskId', () => {
  const alpha = project({ targets: { version: {}, 'version:all': {}, build: {} } })
  const projects = createMap([['lib-alpha', alpha]])

  it('splits the project from the target', () => {
    expect(parseTaskId('lib-alpha:build', projects)).toEqual({ project: alpha, target: 'build' })
  })

  it('reads the longest target name the rest names', () => {
    expect(parseTaskId('lib-alpha:version:all', projects).target).toBe('version:all')
  })

  it('refuses a configuration after the target', () => {
    expect(() => parseTaskId('lib-alpha:build:production', projects)).toThrow(
      'lib-alpha:build:production names the configuration production; targets run without configurations'
    )
  })

  it('refuses a target the project does not have', () => {
    expect(() => parseTaskId('lib-alpha:serve', projects)).toThrow('project lib-alpha has no target serve')
  })

  it('refuses any target of a project without a configuration', () => {
    expect(() => parseTaskId('lib-alpha:build', createMap([['lib-alpha', project(null)]]))).toThrow('project lib-alpha has no target build')
  })

  it('refuses a project the workspace does not have', () => {
    expect(() => parseTaskId('lib-beta:build', projects)).toThrow('no project named lib-beta')
  })

  it.each(['lib-alpha', ':build', 'lib-alpha:'])('refuses %j', (id) => {
    expect(() => parseTaskId(id, projects)).toThrow(`expected <project>:<target>, got ${id}`)
  })
})

describe('executorOf', () => {
  it('answers the executor of the target', () => {
    expect(executorOf({ executor: 'a:b', options: {} }, 'lib-a:b')).toBe('a:b')
  })

  it('refuses a target running a configuration by default', () => {
    expect(() => executorOf({ executor: 'a:b', defaultConfiguration: 'production', options: {} }, 'lib-a:b')).toThrow(
      'lib-a:b runs the configuration production by default; targets run without configurations'
    )
  })

  it('refuses a target naming no executor', () => {
    expect(() => executorOf({ options: {} }, 'lib-a:b')).toThrow('lib-a:b names no executor and no command')
  })
})
