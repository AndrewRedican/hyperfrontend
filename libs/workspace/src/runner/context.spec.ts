import type { ProjectRecord } from '../graph/model'
import type { ResolvedProject } from './context'
import type { WorkspaceConfiguration } from './contract'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { executorContext, projectConfiguration, projectConfigurations } from './context'

/** A workspace configuration as the executors read it. */
const NX: WorkspaceConfiguration = {
  targetDefaults: {
    build: { executor: '@fixture/tooling:build', options: { outputPath: 'dist/{projectRoot}' } },
    version: { executor: '@fixture/tooling:version', options: { maxCommitFallback: 170 } },
  },
}

/** A library with a configuration beside its manifest. */
const ALPHA: ProjectRecord = {
  name: 'lib-alpha',
  root: 'libs/alpha',
  type: 'lib',
  tags: ['npm:public', 'scope:alpha'],
  implicitDependencies: ['lib-beta'],
  files: [],
  manifest: { name: '@fixture/alpha' },
  configuration: { name: 'lib-alpha', projectType: 'library', sourceRoot: '{projectRoot}/src', targets: { build: {} } },
}

/** A package without a configuration. */
const BETA: ProjectRecord = {
  name: '@fixture/beta',
  root: 'libs/beta',
  type: 'lib',
  tags: [],
  implicitDependencies: [],
  files: [],
  manifest: { name: '@fixture/beta' },
  configuration: null,
}

/** A project with a configuration naming no type, and no manifest. */
const GAMMA: ProjectRecord = {
  name: 'app-gamma',
  root: 'apps/gamma',
  type: 'app',
  tags: [],
  implicitDependencies: [],
  files: [],
  manifest: null,
  configuration: { targets: {} },
}

const projects = createMap([
  [ALPHA.name, ALPHA],
  [BETA.name, BETA],
  [GAMMA.name, GAMMA],
])

describe('projectConfiguration', () => {
  it('keeps the configuration as written, with the discovered name, root, tags and dependencies and the resolved targets', () => {
    expect(projectConfiguration(NX, ALPHA)).toEqual({
      name: 'lib-alpha',
      root: 'libs/alpha',
      projectType: 'library',
      sourceRoot: '{projectRoot}/src',
      tags: ['npm:public', 'scope:alpha'],
      implicitDependencies: ['lib-beta'],
      targets: { build: { executor: '@fixture/tooling:build', options: { outputPath: 'dist/libs/alpha' } } },
    })
  })

  it.each([BETA, GAMMA])('leaves the type of $name unset, whose configuration names none', (project) => {
    expect(projectConfiguration(NX, project).projectType).toBe(undefined)
  })
})

describe('projectConfigurations', () => {
  it('configures every project by name', () => {
    expect(keys(projectConfigurations(NX, projects))).toEqual(['lib-alpha', '@fixture/beta', 'app-gamma'])
  })
})

describe('executorContext', () => {
  const configurations = projectConfigurations(NX, projects)
  const target = (configurations['lib-alpha'] as ResolvedProject).targets['build']
  const context = executorContext({
    root: '/work',
    cwd: '/work/libs',
    projectName: 'lib-alpha',
    targetName: 'build',
    target: target as ResolvedProject['targets'][string],
    configuration: NX,
    configurations,
  })

  it('names the root, the working directory, the task and the target', () => {
    expect({
      root: context.root,
      cwd: context.cwd,
      projectName: context.projectName,
      targetName: context.targetName,
      target: context.target,
    }).toEqual({
      root: '/work',
      cwd: '/work/libs',
      projectName: 'lib-alpha',
      targetName: 'build',
      target: { executor: '@fixture/tooling:build', options: { outputPath: 'dist/libs/alpha' } },
    })
  })

  it('answers the project root the executors read from the project configurations', () => {
    expect(context.projects['lib-alpha']?.root).toBe('libs/alpha')
  })

  it('answers the project type the publish executor reads', () => {
    expect(context.projects['lib-alpha']?.projectType).toBe('library')
  })

  it('answers the defaults of the version target the batch executor reads from hf.json', () => {
    expect(context.configuration.targetDefaults?.['version']).toEqual({
      executor: '@fixture/tooling:version',
      options: { maxCommitFallback: 170 },
    })
  })
})
