import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { planRunnableProject, writeRunnableProject } from './runnable-project'
import { readJson } from './tree'

const ROOT_FILES = { 'package.json': '{ "name": "@acme/monorepo" }' }

/** The targets the workspace's defaults configure whole. */
const TARGETS = { typecheck: {}, test: {} }

const templates = useTempDir({
  scope: 'all',
  prefix: 'runnable-',
  tree: { 'src/main.ts.template': "export const kind = '<%= kind %>'\nexport const base = '<%= offsetFromRoot %>tsconfig.base.json'\n" },
})

describe('planRunnableProject', () => {
  it('settles the names, the applications directory and the description from the name and the kind', () => {
    expect(planRunnableProject(createMemoryTree(ROOT_FILES), { name: 'AdminPortal' }, 'application')).toEqual({
      kind: 'application',
      name: 'admin-portal',
      projectName: 'admin-portal',
      packageName: '@acme/admin-portal',
      projectRoot: 'apps/admin-portal',
      description: 'AdminPortal application.',
      tags: [],
      offsetFromRoot: '../../',
    })
  })

  it('takes the directory, the project name, the description and the tags as given', () => {
    expect(
      planRunnableProject(
        createMemoryTree(ROOT_FILES),
        {
          name: 'jobs',
          directory: 'services/internal',
          projectName: 'service-jobs',
          description: 'Runs the jobs.',
          tags: ['type:service'],
        },
        'service'
      )
    ).toEqual({
      kind: 'service',
      name: 'jobs',
      projectName: 'service-jobs',
      packageName: '@acme/jobs',
      projectRoot: 'services/internal/jobs',
      description: 'Runs the jobs.',
      tags: ['type:service'],
      offsetFromRoot: '../../../',
    })
  })

  it('names the package without a scope where the tree has no root manifest', () => {
    expect(planRunnableProject(createMemoryTree({}), { name: 'api' }, 'service').packageName).toBe('api')
  })

  it('names the package without a scope where the root manifest has no name', () => {
    expect(planRunnableProject(createMemoryTree({ 'package.json': '{ "private": true }' }), { name: 'api' }, 'service').packageName).toBe(
      'api'
    )
  })
})

describe('writeRunnableProject', () => {
  it('writes the templates under the project with the plan substituted', () => {
    const tree = createMemoryTree(ROOT_FILES)
    writeRunnableProject(tree, templates.path, planRunnableProject(tree, { name: 'api' }, 'service'), TARGETS)
    expect(tree.read('apps/api/src/main.ts', 'utf-8')).toBe(
      "export const kind = 'service'\nexport const base = '../../tsconfig.base.json'\n"
    )
  })

  it('writes a private ES module manifest', () => {
    const tree = createMemoryTree(ROOT_FILES)
    writeRunnableProject(tree, templates.path, planRunnableProject(tree, { name: 'api', description: 'The API.' }, 'service'), TARGETS)
    expect(readJson(tree, 'apps/api/package.json')).toEqual({
      name: '@acme/api',
      version: '0.0.0',
      description: 'The API.',
      type: 'module',
      private: true,
    })
  })

  it('writes the project with its kind, its tags and its targets', () => {
    const tree = createMemoryTree(ROOT_FILES)
    writeRunnableProject(tree, templates.path, planRunnableProject(tree, { name: 'api', tags: ['scope:internal'] }, 'service'), TARGETS)
    expect(readJson(tree, 'apps/api/project.json')).toEqual({
      name: 'api',
      description: 'Api service.',
      sourceRoot: '{projectRoot}/src',
      projectType: 'service',
      tags: ['scope:internal'],
      targets: { typecheck: {}, test: {} },
    })
  })

  it('writes the targets it is given', () => {
    const tree = createMemoryTree(ROOT_FILES)
    writeRunnableProject(tree, templates.path, planRunnableProject(tree, { name: 'api' }, 'service'), {
      build: { executor: '@acme/tools:bundle', options: { minify: true } },
      dev: { command: 'node {projectRoot}/src/main.ts' },
      test: {},
    })
    expect(tree.read('apps/api/project.json', 'utf-8')).toContain(
      [
        '  "targets": {',
        '    "build": {',
        '      "executor": "@acme/tools:bundle",',
        '      "options": {',
        '        "minify": true',
        '      }',
        '    },',
        '    "dev": {',
        '      "command": "node {projectRoot}/src/main.ts"',
        '    },',
        '    "test": {}',
        '  }',
      ].join('\n')
    )
  })

  it('refuses a directory that is already there', () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'apps/api/src/main.ts': 'export const kept = true\n' })
    expect(() => writeRunnableProject(tree, templates.path, planRunnableProject(tree, { name: 'api' }, 'service'), TARGETS)).toThrow(
      'Destination already exists: apps/api'
    )
  })

  it('writes nothing over the files of a directory it refuses', () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'apps/api/src/main.ts': 'export const kept = true\n' })
    try {
      writeRunnableProject(tree, templates.path, planRunnableProject(tree, { name: 'api' }, 'service'), TARGETS)
    } catch {
      // note: the refusal is asserted by the case before; this one reads what it left behind
    }
    expect(tree.listChanges()).toEqual([])
  })

  it('refuses a project name another project already holds', () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'libs/api/project.json': '{ "name": "api" }' })
    expect(() => writeRunnableProject(tree, templates.path, planRunnableProject(tree, { name: 'api' }, 'service'), TARGETS)).toThrow(
      "Project name already in use: 'api' is the project at libs/api"
    )
  })
})
