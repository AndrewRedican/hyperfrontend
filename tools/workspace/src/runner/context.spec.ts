import type { NxJsonConfiguration } from '@hyperfrontend/integration-nx/compat'
import type { ProjectRecord } from '../graph/model'
import type { ResolvedProject } from './context'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { executorContext, projectConfiguration, projectConfigurations, projectGraph } from './context'

/** A workspace configuration as the executors read it. */
const NX: NxJsonConfiguration = {
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

/** A package without a configuration, its type in the manifest's `nx` field. */
const BETA: ProjectRecord = {
  name: '@fixture/beta',
  root: 'libs/beta',
  type: 'lib',
  tags: [],
  implicitDependencies: [],
  files: [],
  manifest: { name: '@fixture/beta', nx: { projectType: 'library' } },
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

  it('reads the type of a package without a configuration from its manifest', () => {
    expect(projectConfiguration(NX, BETA).projectType).toBe('library')
  })

  it('leaves the type unset when neither file names one', () => {
    expect(projectConfiguration(NX, GAMMA).projectType).toBe(undefined)
  })
})

describe('projectConfigurations', () => {
  it('configures every project by name', () => {
    expect(keys(projectConfigurations(NX, projects))).toEqual(['lib-alpha', '@fixture/beta', 'app-gamma'])
  })
})

describe('projectGraph', () => {
  const configurations = projectConfigurations(NX, projects)

  it('gives every project a node whose data is its configuration', () => {
    expect(projectGraph(projects, configurations).nodes['lib-alpha']).toEqual({
      name: 'lib-alpha',
      type: 'lib',
      data: configurations['lib-alpha'],
    })
  })

  it('draws an implicit edge for every implicit dependency, and none for a project declaring none', () => {
    expect(projectGraph(projects, configurations).dependencies).toEqual({
      'lib-alpha': [{ source: 'lib-alpha', target: 'lib-beta', type: 'implicit' }],
      '@fixture/beta': [],
      'app-gamma': [],
    })
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
    nx: NX,
    projects,
    configurations,
  })

  it('names the root, the working directory, the task and the target, and is not verbose', () => {
    expect({
      root: context.root,
      cwd: context.cwd,
      projectName: context.projectName,
      targetName: context.targetName,
      configurationName: context.configurationName,
      target: context.target,
      isVerbose: context.isVerbose,
    }).toEqual({
      root: '/work',
      cwd: '/work/libs',
      projectName: 'lib-alpha',
      targetName: 'build',
      configurationName: undefined,
      target: { executor: '@fixture/tooling:build', options: { outputPath: 'dist/libs/alpha' } },
      isVerbose: false,
    })
  })

  it('answers the project root the executors read from the project configurations', () => {
    expect(context.projectsConfigurations.projects['lib-alpha']?.root).toBe('libs/alpha')
  })

  it('answers the project type the publish executor reads', () => {
    expect(context.projectsConfigurations.projects['lib-alpha']?.projectType).toBe('library')
  })

  it('writes the project configurations in their second version', () => {
    expect(context.projectsConfigurations.version).toBe(2)
  })

  it('answers the project root the versioning executors read from the graph', () => {
    expect(context.projectGraph.nodes['lib-alpha']?.data.root).toBe('libs/alpha')
  })

  it('answers the defaults of the version target the batch executor reads from nx.json', () => {
    expect(context.nxJsonConfiguration.targetDefaults?.['version']).toEqual({
      executor: '@fixture/tooling:version',
      options: { maxCommitFallback: 170 },
    })
  })
})
