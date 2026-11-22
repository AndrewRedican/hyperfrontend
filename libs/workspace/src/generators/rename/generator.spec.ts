import { join } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { planRename, renameGenerator } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const FILES = {
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@acme/alpha": ["libs/alpha/src/index.ts"], "@acme/beta": ["libs/beta/src/index.ts"] } } }',
  'libs/alpha/project.json': '{ "name": "alpha", "description": "The @acme/alpha library" }',
  'libs/alpha/package.json': '{ "name": "@acme/alpha", "description": "The @acme/alpha library" }',
  'libs/alpha/README.md': '# @acme/alpha\n',
  'libs/alpha/src/index.ts': '/**\n * @module @acme/alpha\n */\n',
  'libs/beta/project.json': '{ "name": "beta", "implicitDependencies": ["alpha"] }',
  'e2e/alpha/project.json': '{ "name": "e2e-alpha", "targets": { "e2e": {} }, "implicitDependencies": ["alpha"] }',
  'e2e/alpha/package.json':
    '{ "name": "@acme/e2e-alpha", "dependencies": { "@acme/alpha": "file:../../tmp/e2e-packs/acme-alpha-0.0.0.tgz" } }',
}

const SIBLINGS = {
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@acme/core": ["libs/core/src/index.ts"], "@acme/core/testing": ["libs/core/src/testing/index.ts"], "@acme/core-ui": ["libs/core-ui/src/index.ts"], "@acme/core-ui/theme": ["libs/core-ui/src/theme/index.ts"] } } }',
  'libs/core/project.json': '{ "name": "core", "description": "The @acme/core library, the base of @acme/core-ui" }',
  'libs/core/package.json': '{ "name": "@acme/core", "description": "The @acme/core library, the base of @acme/core-ui" }',
  'libs/core/README.md': '# @acme/core\n\nSee also @acme/core-ui and `@acme/core/testing`.\n',
  'libs/core/src/index.ts': "/**\n * @module @acme/core\n */\nexport * from '@acme/core-ui'\n",
  'libs/core-ui/project.json': '{ "name": "core-ui", "description": "UI over @acme/core", "implicitDependencies": ["core"] }',
  'libs/core-ui/package.json': '{ "name": "@acme/core-ui", "description": "UI over @acme/core" }',
  'libs/core-ui/README.md': '# @acme/core-ui\n',
  'e2e/core/project.json':
    '{ "name": "e2e-core", "description": "Tests @acme/core beside @acme/core-ui", "targets": { "e2e": {} }, "implicitDependencies": ["core"] }',
  'e2e/core/package.json':
    '{ "name": "@acme/e2e-core", "description": "Tests @acme/core beside @acme/core-ui", "dependencies": { "@acme/core": "file:../../tmp/e2e-packs/acme-core-0.0.0.tgz", "@acme/core-ui": "file:../../tmp/e2e-packs/acme-core-ui-0.0.0.tgz" } }',
  'e2e/core-ui/project.json':
    '{ "name": "e2e-core-ui", "description": "Tests @acme/core-ui", "targets": { "e2e": {} }, "implicitDependencies": ["core-ui"] }',
  'e2e/core-ui/package.json':
    '{ "name": "@acme/e2e-core-ui", "dependencies": { "@acme/core-ui": "file:../../tmp/e2e-packs/acme-core-ui-0.0.0.tgz" } }',
}

describe('planRename', () => {
  it('names the package after the new name under its scope', () => {
    expect(planRename(createMemoryTree(FILES), { project: 'alpha', newName: 'omega' })).toEqual({
      currentProjectName: 'alpha',
      projectRoot: 'libs/alpha',
      newProjectName: 'omega',
      currentPackageName: '@acme/alpha',
      newPackageName: '@acme/omega',
    })
  })

  it('takes the package name as given', () => {
    expect(planRename(createMemoryTree(FILES), { project: 'alpha', newName: 'omega', packageName: '@other/om' }).newPackageName).toBe(
      '@other/om'
    )
  })

  it('plans no package name for a project without a package', () => {
    expect(planRename(createMemoryTree(FILES), { project: 'beta', newName: 'gamma' })).toEqual(
      expect.objectContaining({ currentPackageName: undefined, newPackageName: undefined })
    )
  })

  it('refuses a name another project holds', () => {
    expect(() => planRename(createMemoryTree(FILES), { project: 'alpha', newName: 'beta' })).toThrow(
      "Project name already in use: 'beta' is the project at libs/beta"
    )
  })

  it('refuses the current name', () => {
    expect(() => planRename(createMemoryTree(FILES), { project: 'alpha', newName: 'alpha' })).toThrow(
      'New name must be different from current name: alpha'
    )
  })
})

describe('renameGenerator', () => {
  it('renames the project and the package in their manifests', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ project: readJson(tree, 'libs/alpha/project.json'), pkg: readJson(tree, 'libs/alpha/package.json') }).toEqual({
      project: { name: 'omega', description: 'The @acme/omega library' },
      pkg: { name: '@acme/omega', description: 'The @acme/omega library' },
    })
  })

  it('renames the alias', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect(readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@acme/beta': ['libs/beta/src/index.ts'],
      '@acme/omega': ['libs/alpha/src/index.ts'],
    })
  })

  it('renames the project where others depend on it, and the project that tests it', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ beta: readJson(tree, 'libs/beta/project.json'), e2e: readJson(tree, 'e2e/alpha/project.json') }).toEqual({
      beta: { name: 'beta', implicitDependencies: ['omega'] },
      e2e: { name: 'e2e-omega', targets: { e2e: {} }, implicitDependencies: ['omega'] },
    })
  })

  it('renames the tasks and the inputs of the project where others and the workspace file name them, and in its own targets', async () => {
    const tree = createMemoryTree({
      ...FILES,
      'hf.json': '{ "namedInputs": { "tooling": [{ "input": "production", "projects": ["alpha"] }] } }',
      'libs/alpha/project.json': '{ "name": "alpha", "targets": { "build": {}, "test": { "dependsOn": ["alpha:build"] } } }',
      'libs/beta/project.json':
        '{ "name": "beta", "targets": { "alpha": {}, "build": { "dependsOn": ["alpha", "alpha:build", "^build"], "inputs": [{ "input": "production", "projects": "alpha" }] } } }',
    })
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({
      workspace: readJson(tree, 'hf.json'),
      own: readJson(tree, 'libs/alpha/project.json'),
      beta: readJson(tree, 'libs/beta/project.json'),
    }).toEqual({
      workspace: { namedInputs: { tooling: [{ input: 'production', projects: ['omega'] }] } },
      own: { name: 'omega', targets: { build: {}, test: { dependsOn: ['omega:build'] } } },
      beta: {
        name: 'beta',
        targets: {
          alpha: {},
          build: { dependsOn: ['alpha', 'omega:build', '^build'], inputs: [{ input: 'production', projects: 'omega' }] },
        },
      },
    })
  })

  it('renames the project named after the library among those that test it, whichever stands first', async () => {
    const tree = createMemoryTree({
      ...FILES,
      'e2e/a-first/project.json': '{ "name": "e2e-beta", "targets": { "e2e": {} }, "implicitDependencies": ["beta", "alpha"] }',
      'e2e/a-first/package.json':
        '{ "name": "@acme/e2e-beta", "dependencies": { "@acme/alpha": "file:../../tmp/e2e-packs/acme-alpha-0.0.0.tgz" } }',
    })
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({
      named: readJson(tree, 'e2e/alpha/project.json'),
      namedPkg: readJson(tree, 'e2e/alpha/package.json'),
      other: readJson(tree, 'e2e/a-first/project.json'),
      otherPkg: readJson(tree, 'e2e/a-first/package.json'),
    }).toEqual({
      named: { name: 'e2e-omega', targets: { e2e: {} }, implicitDependencies: ['omega'] },
      namedPkg: { name: '@acme/e2e-omega', dependencies: { '@acme/omega': 'file:../../tmp/e2e-packs/acme-omega-0.0.0.tgz' } },
      other: { name: 'e2e-beta', targets: { e2e: {} }, implicitDependencies: ['beta', 'omega'] },
      otherPkg: { name: '@acme/e2e-beta', dependencies: { '@acme/omega': 'file:../../tmp/e2e-packs/acme-omega-0.0.0.tgz' } },
    })
  })

  it('writes nothing when another project holds the new name', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'beta', skipFormat: true }).catch(() => undefined)
    expect(tree.listChanges()).toEqual([])
  })

  it("refuses a package name another project's package holds, writing nothing", async () => {
    const tree = createMemoryTree(SIBLINGS)
    const refusal = await renameGenerator(tree, {
      project: 'core',
      newName: 'fresh',
      packageName: '@acme/core-ui',
      skipFormat: true,
    }).catch((error: Error) => error.message)
    expect({ refusal, changes: tree.listChanges() }).toEqual({
      refusal: "Package name already in use: '@acme/core-ui' is the package at libs/core-ui",
      changes: [],
    })
  })

  it('refuses a package name the base tsconfig already holds an alias under', async () => {
    const tree = createMemoryTree({
      ...FILES,
      'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@acme/omega/testing": ["vendor/omega/testing.ts"] } } }',
    })
    await expect(renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })).rejects.toThrow(
      "Package name already in use: '@acme/omega/testing' is an alias in tsconfig.base.json"
    )
  })

  it('refuses a name whose test project would take the name another project holds, writing nothing', async () => {
    const tree = createMemoryTree({ ...FILES, 'tools/x/project.json': '{ "name": "e2e-omega" }' })
    const refusal = await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true }).catch(
      (error: Error) => error.message
    )
    expect({ refusal, changes: tree.listChanges() }).toEqual({
      refusal: "Project name already in use: 'e2e-omega' is the project at tools/x",
      changes: [],
    })
  })

  it('renames the project alone when the package name given is the one it has', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', packageName: '@acme/alpha', skipFormat: true })
    expect({
      project: readJson<{ name: string }>(tree, 'libs/alpha/project.json').name,
      pkg: readJson<{ name: string }>(tree, 'libs/alpha/package.json').name,
    }).toEqual({ project: 'omega', pkg: '@acme/alpha' })
  })

  it('rewrites the README and the module header', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ readme: tree.read('libs/alpha/README.md', 'utf-8'), entry: tree.read('libs/alpha/src/index.ts', 'utf-8') }).toEqual({
      readme: '# @acme/omega\n',
      entry: '/**\n * @module @acme/omega\n */\n',
    })
  })

  it('keeps the mentions of a sibling whose package name starts with the renamed one in the manifests, the README and the entry', async () => {
    const tree = createMemoryTree(SIBLINGS)
    await renameGenerator(tree, { project: 'core', newName: 'kernel', skipFormat: true })
    expect({
      project: readJson(tree, 'libs/core/project.json'),
      pkg: readJson(tree, 'libs/core/package.json'),
      readme: tree.read('libs/core/README.md', 'utf-8'),
      entry: tree.read('libs/core/src/index.ts', 'utf-8'),
    }).toEqual({
      project: { name: 'kernel', description: 'The @acme/kernel library, the base of @acme/core-ui' },
      pkg: { name: '@acme/kernel', description: 'The @acme/kernel library, the base of @acme/core-ui' },
      readme: '# @acme/kernel\n\nSee also @acme/core-ui and `@acme/kernel/testing`.\n',
      entry: "/**\n * @module @acme/kernel\n */\nexport * from '@acme/core-ui'\n",
    })
  })

  it('keeps the mentions of such a sibling in the project that tests the renamed one', async () => {
    const tree = createMemoryTree(SIBLINGS)
    await renameGenerator(tree, { project: 'core', newName: 'kernel', skipFormat: true })
    expect({ project: readJson(tree, 'e2e/core/project.json'), pkg: readJson(tree, 'e2e/core/package.json') }).toEqual({
      project: {
        name: 'e2e-kernel',
        description: 'Tests @acme/kernel beside @acme/core-ui',
        targets: { e2e: {} },
        implicitDependencies: ['kernel'],
      },
      pkg: {
        name: '@acme/e2e-kernel',
        description: 'Tests @acme/kernel beside @acme/core-ui',
        dependencies: {
          '@acme/core-ui': 'file:../../tmp/e2e-packs/acme-core-ui-0.0.0.tgz',
          '@acme/kernel': 'file:../../tmp/e2e-packs/acme-kernel-0.0.0.tgz',
        },
      },
    })
  })

  it('leaves such a sibling under its names, its aliases and its tests, renaming the project where the sibling depends on it', async () => {
    const tree = createMemoryTree(SIBLINGS)
    await renameGenerator(tree, { project: 'core', newName: 'kernel', skipFormat: true })
    expect({
      paths: readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths,
      project: readJson(tree, 'libs/core-ui/project.json'),
      pkg: readJson(tree, 'libs/core-ui/package.json'),
      readme: tree.read('libs/core-ui/README.md', 'utf-8'),
      e2eProject: readJson(tree, 'e2e/core-ui/project.json'),
      e2ePkg: readJson(tree, 'e2e/core-ui/package.json'),
    }).toEqual({
      paths: {
        '@acme/core-ui': ['libs/core-ui/src/index.ts'],
        '@acme/core-ui/theme': ['libs/core-ui/src/theme/index.ts'],
        '@acme/kernel': ['libs/core/src/index.ts'],
        '@acme/kernel/testing': ['libs/core/src/testing/index.ts'],
      },
      project: { name: 'core-ui', description: 'UI over @acme/core', implicitDependencies: ['kernel'] },
      pkg: { name: '@acme/core-ui', description: 'UI over @acme/core' },
      readme: '# @acme/core-ui\n',
      e2eProject: { name: 'e2e-core-ui', description: 'Tests @acme/core-ui', targets: { e2e: {} }, implicitDependencies: ['core-ui'] },
      e2ePkg: { name: '@acme/e2e-core-ui', dependencies: { '@acme/core-ui': 'file:../../tmp/e2e-packs/acme-core-ui-0.0.0.tgz' } },
    })
  })

  it('renames a project without a package in its project file and where others depend on it alone', async () => {
    const tree = createMemoryTree({ ...FILES, 'libs/gamma/project.json': '{ "name": "gamma", "implicitDependencies": ["beta"] }' })
    await renameGenerator(tree, { project: 'beta', newName: 'delta', skipFormat: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/beta/project.json', 'libs/gamma/project.json'])
  })

  it('leaves a workspace without a base tsconfig without an alias to rename', async () => {
    const { 'tsconfig.base.json': base, ...files } = FILES
    const tree = createMemoryTree(files)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ base, written: tree.exists('tsconfig.base.json') }).toEqual({ base: expect.any(String), written: false })
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(FILES, { root: REPO_ROOT })
    await renameGenerator(tree, { project: 'alpha', newName: 'omega' })
    expect(readJson<{ name: string }>(tree, 'libs/alpha/package.json').name).toBe('@acme/omega')
  })
})
