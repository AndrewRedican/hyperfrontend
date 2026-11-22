import { join } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { moveGenerator } from './generator'
import { planMove } from './lib/move-helpers'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const FILES = {
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@acme/alpha": ["libs/alpha/src/index.ts"], "@acme/beta": ["libs/beta/src/index.ts"] } } }',
  'libs/alpha/project.json':
    '{ "name": "alpha", "description": "The @acme/alpha library", "targets": { "build": { "options": { "iife": { "globalName": "AcmeAlpha" }, "umd": { "globalName": "AcmeAlpha" } } } } }',
  'libs/alpha/package.json': '{ "name": "@acme/alpha", "description": "The @acme/alpha library" }',
  'libs/alpha/README.md': '# @acme/alpha\n',
  'libs/alpha/lint.config.ts': "import baseConfig from '../../lint.base.config.ts'\n",
  'libs/alpha/tsconfig.json': '{ "extends": "../../tsconfig.base.json" }',
  'libs/alpha/tsconfig.lib.json': '{ "compilerOptions": { "outDir": "../../dist/out-tsc" } }',
  'libs/alpha/tsconfig.spec.json': '{ "compilerOptions": {} }',
  'libs/alpha/src/index.ts': '/**\n * @module @acme/alpha\n */\n',
  'libs/beta/project.json': '{ "name": "beta", "implicitDependencies": ["alpha"] }',
  'e2e/alpha/project.json': '{ "name": "e2e-alpha", "targets": { "e2e": {} }, "implicitDependencies": ["alpha"] }',
}

const SIBLINGS = {
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@acme/core": ["libs/core/src/index.ts"], "@acme/core/testing": ["libs/core/src/testing/index.ts"], "@acme/core-ui": ["libs/core-ui/src/index.ts"], "@acme/core-ui/theme": ["libs/core-ui/src/theme/index.ts"] } } }',
  'libs/core/project.json': '{ "name": "core", "description": "The @acme/core library, the base of @acme/core-ui" }',
  'libs/core/package.json': '{ "name": "@acme/core", "description": "The @acme/core library, the base of @acme/core-ui" }',
  'libs/core/README.md': '# @acme/core\n\nSee also @acme/core-ui and `@acme/core/testing`.\n',
  'libs/core/src/index.ts': "/**\n * @module @acme/core\n */\nexport * from '@acme/core-ui'\n",
  'libs/core-ui/project.json': '{ "name": "core-ui", "implicitDependencies": ["core"] }',
  'libs/core-ui/package.json': '{ "name": "@acme/core-ui" }',
  'libs/core-ui/src/index.ts': '/**\n * @module @acme/core-ui\n */\n',
  'e2e/core/project.json': '{ "name": "e2e-core", "targets": { "e2e": {} }, "implicitDependencies": ["core"] }',
  'e2e/core-ui/project.json': '{ "name": "e2e-core-ui", "targets": { "e2e": {} }, "implicitDependencies": ["core-ui"] }',
  'e2e/core-ui/package.json':
    '{ "name": "@acme/e2e-core-ui", "dependencies": { "@acme/core-ui": "file:../../tmp/e2e-packs/acme-core-ui-0.0.0.tgz" } }',
}

describe('planMove', () => {
  it('names the project and the package after the directory under the destination', () => {
    expect(planMove(createMemoryTree(FILES), { project: 'alpha', destination: 'packages/core' })).toEqual({
      projectName: 'alpha',
      currentProjectRoot: 'libs/alpha',
      newProjectRoot: 'packages/core/alpha',
      newProjectName: 'alpha',
      currentPackageName: '@acme/alpha',
      newPackageName: '@acme/alpha',
      updateName: true,
      newOffsetFromRoot: '../../../',
    })
  })

  it('takes a new directory name, and the project and package names as given', () => {
    expect(
      planMove(createMemoryTree(FILES), {
        project: 'alpha',
        destination: 'packages',
        newName: 'Omega',
        projectName: 'lib-omega',
        packageName: '@acme/om',
      })
    ).toEqual(expect.objectContaining({ newProjectRoot: 'packages/omega', newProjectName: 'lib-omega', newPackageName: '@acme/om' }))
  })

  it('keeps the names when asked to', () => {
    expect(planMove(createMemoryTree(FILES), { project: 'alpha', destination: 'packages', newName: 'omega', updateName: false })).toEqual(
      expect.objectContaining({ newProjectRoot: 'packages/omega', newProjectName: 'alpha', newPackageName: '@acme/alpha' })
    )
  })

  it('plans no package name for a project without a package', () => {
    expect(planMove(createMemoryTree(FILES), { project: 'beta', destination: 'packages' })).toEqual(
      expect.objectContaining({ currentPackageName: undefined, newPackageName: undefined })
    )
  })
})

describe('moveGenerator', () => {
  it('moves every file of the project', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect(tree.listChanges().map((change) => [change.type, change.path])).toEqual([
      ['UPDATE', 'e2e/alpha/project.json'],
      ['DELETE', 'libs/alpha/lint.config.ts'],
      ['DELETE', 'libs/alpha/package.json'],
      ['DELETE', 'libs/alpha/project.json'],
      ['DELETE', 'libs/alpha/README.md'],
      ['DELETE', 'libs/alpha/src/index.ts'],
      ['DELETE', 'libs/alpha/tsconfig.json'],
      ['DELETE', 'libs/alpha/tsconfig.lib.json'],
      ['DELETE', 'libs/alpha/tsconfig.spec.json'],
      ['UPDATE', 'libs/beta/project.json'],
      ['CREATE', 'packages/omega/lint.config.ts'],
      ['CREATE', 'packages/omega/package.json'],
      ['CREATE', 'packages/omega/project.json'],
      ['CREATE', 'packages/omega/README.md'],
      ['CREATE', 'packages/omega/src/index.ts'],
      ['CREATE', 'packages/omega/tsconfig.json'],
      ['CREATE', 'packages/omega/tsconfig.lib.json'],
      ['CREATE', 'packages/omega/tsconfig.spec.json'],
      ['UPDATE', 'tsconfig.base.json'],
    ])
  })

  it('renames the project, its description and the globals of its browser bundles', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect(readJson(tree, 'packages/omega/project.json')).toEqual({
      name: 'omega',
      description: 'The @acme/omega library',
      targets: { build: { options: { iife: { globalName: 'AcmeOmega' }, umd: { globalName: 'AcmeOmega' } } } },
    })
  })

  it('points the configuration files at the root from the new depth', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages/core', skipFormat: true })
    expect({
      lint: tree.read('packages/core/alpha/lint.config.ts', 'utf-8'),
      tsconfig: readJson(tree, 'packages/core/alpha/tsconfig.json'),
      lib: readJson(tree, 'packages/core/alpha/tsconfig.lib.json'),
      spec: readJson(tree, 'packages/core/alpha/tsconfig.spec.json'),
    }).toEqual({
      lint: "import baseConfig from '../../../lint.base.config.ts'\n",
      tsconfig: { extends: '../../../tsconfig.base.json' },
      lib: { compilerOptions: { outDir: '../../../dist/out-tsc' } },
      spec: { compilerOptions: {} },
    })
  })

  it('moves the alias, renames the project where others depend on it, and renames the project that tests it', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect({
      paths: readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths,
      beta: readJson(tree, 'libs/beta/project.json'),
      e2e: readJson(tree, 'e2e/alpha/project.json'),
      readme: tree.read('packages/omega/README.md', 'utf-8'),
    }).toEqual({
      paths: { '@acme/beta': ['libs/beta/src/index.ts'], '@acme/omega': ['packages/omega/src/index.ts'] },
      beta: { name: 'beta', implicitDependencies: ['omega'] },
      e2e: { name: 'e2e-omega', targets: { e2e: {} }, implicitDependencies: ['omega'] },
      readme: '# @acme/omega\n',
    })
  })

  it('keeps the names and the references when asked to, moving the alias alone', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', updateName: false, skipFormat: true })
    expect({
      paths: readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths,
      project: readJson<{ name: string }>(tree, 'packages/omega/project.json').name,
      pkg: readJson<{ name: string }>(tree, 'packages/omega/package.json').name,
      beta: readJson(tree, 'libs/beta/project.json'),
    }).toEqual({
      paths: { '@acme/alpha': ['packages/omega/src/index.ts'], '@acme/beta': ['libs/beta/src/index.ts'] },
      project: 'alpha',
      pkg: '@acme/alpha',
      beta: { name: 'beta', implicitDependencies: ['alpha'] },
    })
  })

  it.each([
    ['are kept', { updateName: false }],
    ['follow the move without changing', {}],
  ])('copies the manifests and the configuration files as they are written when the depth stays and the names %s', async (_case, names) => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', ...names, skipFormat: true })
    expect({
      project: tree.read('packages/alpha/project.json', 'utf-8'),
      pkg: tree.read('packages/alpha/package.json', 'utf-8'),
      tsconfig: tree.read('packages/alpha/tsconfig.json', 'utf-8'),
      lib: tree.read('packages/alpha/tsconfig.lib.json', 'utf-8'),
      spec: tree.read('packages/alpha/tsconfig.spec.json', 'utf-8'),
    }).toEqual({
      project: FILES['libs/alpha/project.json'],
      pkg: FILES['libs/alpha/package.json'],
      tsconfig: FILES['libs/alpha/tsconfig.json'],
      lib: FILES['libs/alpha/tsconfig.lib.json'],
      spec: FILES['libs/alpha/tsconfig.spec.json'],
    })
  })

  it('leaves the projects that hold the name of the moved one only where it is no reference as they are written', async () => {
    const prose = '{ "name": "prose",   "description": "Reads alpha", "tags": ["alpha",\n"x"] }'
    const tree = createMemoryTree({ ...FILES, 'libs/prose/project.json': prose })
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect(tree.read('libs/prose/project.json', 'utf-8')).toBe(prose)
  })

  it('renames the tasks and the inputs of the moved project where others and the workspace file name them, and in its own targets', async () => {
    const tree = createMemoryTree({
      ...FILES,
      'hf.json': '{ "targetDefaults": { "build": { "inputs": [{ "input": "production", "projects": "alpha" }] } } }',
      'libs/alpha/project.json': '{ "name": "alpha", "targets": { "build": {}, "test": { "dependsOn": ["alpha:build"] } } }',
      'libs/beta/project.json': '{ "name": "beta", "targets": { "build": { "dependsOn": ["alpha:build", "^build"] } } }',
    })
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect({
      workspace: readJson(tree, 'hf.json'),
      own: readJson(tree, 'packages/omega/project.json'),
      beta: readJson(tree, 'libs/beta/project.json'),
    }).toEqual({
      workspace: { targetDefaults: { build: { inputs: [{ input: 'production', projects: 'omega' }] } } },
      own: { name: 'omega', targets: { build: {}, test: { dependsOn: ['omega:build'] } } },
      beta: { name: 'beta', targets: { build: { dependsOn: ['omega:build', '^build'] } } },
    })
  })

  it('moves the aliases of the project alone when the directory name of a sibling starts with its own', async () => {
    const tree = createMemoryTree(SIBLINGS)
    await moveGenerator(tree, { project: 'core', destination: 'packages', updateName: false, skipFormat: true })
    expect(readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@acme/core': ['packages/core/src/index.ts'],
      '@acme/core/testing': ['packages/core/src/testing/index.ts'],
      '@acme/core-ui': ['libs/core-ui/src/index.ts'],
      '@acme/core-ui/theme': ['libs/core-ui/src/theme/index.ts'],
    })
  })

  it('keeps the mentions of such a sibling in the manifests, the README and the entry of the moved project', async () => {
    const tree = createMemoryTree(SIBLINGS)
    await moveGenerator(tree, { project: 'core', destination: 'packages', newName: 'kernel', skipFormat: true })
    expect({
      project: readJson(tree, 'packages/kernel/project.json'),
      pkg: readJson(tree, 'packages/kernel/package.json'),
      readme: tree.read('packages/kernel/README.md', 'utf-8'),
      entry: tree.read('packages/kernel/src/index.ts', 'utf-8'),
    }).toEqual({
      project: { name: 'kernel', description: 'The @acme/kernel library, the base of @acme/core-ui' },
      pkg: { name: '@acme/kernel', description: 'The @acme/kernel library, the base of @acme/core-ui' },
      readme: '# @acme/kernel\n\nSee also @acme/core-ui and `@acme/kernel/testing`.\n',
      entry: "/**\n * @module @acme/kernel\n */\nexport * from '@acme/core-ui'\n",
    })
  })

  it('leaves such a sibling under its names, its aliases and its tests, renaming the moved project where the sibling depends on it', async () => {
    const tree = createMemoryTree(SIBLINGS)
    await moveGenerator(tree, { project: 'core', destination: 'packages', newName: 'kernel', skipFormat: true })
    expect({
      paths: readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths,
      project: readJson(tree, 'libs/core-ui/project.json'),
      pkg: readJson(tree, 'libs/core-ui/package.json'),
      entry: tree.read('libs/core-ui/src/index.ts', 'utf-8'),
      e2eProject: readJson(tree, 'e2e/core-ui/project.json'),
      e2ePkg: readJson(tree, 'e2e/core-ui/package.json'),
    }).toEqual({
      paths: {
        '@acme/core-ui': ['libs/core-ui/src/index.ts'],
        '@acme/core-ui/theme': ['libs/core-ui/src/theme/index.ts'],
        '@acme/kernel': ['packages/kernel/src/index.ts'],
        '@acme/kernel/testing': ['packages/kernel/src/testing/index.ts'],
      },
      project: { name: 'core-ui', implicitDependencies: ['kernel'] },
      pkg: { name: '@acme/core-ui' },
      entry: '/**\n * @module @acme/core-ui\n */\n',
      e2eProject: { name: 'e2e-core-ui', targets: { e2e: {} }, implicitDependencies: ['core-ui'] },
      e2ePkg: { name: '@acme/e2e-core-ui', dependencies: { '@acme/core-ui': 'file:../../tmp/e2e-packs/acme-core-ui-0.0.0.tgz' } },
    })
  })

  it('moves a project without a package, without configuration files, renaming it where others depend on it', async () => {
    const tree = createMemoryTree({ ...FILES, 'libs/gamma/project.json': '{ "name": "gamma", "implicitDependencies": ["beta"] }' })
    await moveGenerator(tree, { project: 'beta', destination: 'packages', newName: 'delta', skipFormat: true })
    expect(tree.listChanges().map((change) => [change.type, change.path])).toEqual([
      ['DELETE', 'libs/beta/project.json'],
      ['UPDATE', 'libs/gamma/project.json'],
      ['CREATE', 'packages/delta/project.json'],
    ])
  })

  it('leaves a workspace without a base tsconfig without an alias to move', async () => {
    const { 'tsconfig.base.json': base, ...files } = FILES
    const tree = createMemoryTree(files)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', skipFormat: true })
    expect({ base, written: tree.exists('tsconfig.base.json') }).toEqual({ base: expect.any(String), written: false })
  })

  it('brings the project that tests the library along when the package is renamed under a project name that stays', async () => {
    const tree = createMemoryTree({
      ...FILES,
      'e2e/alpha/package.json':
        '{ "name": "@acme/e2e-alpha", "dependencies": { "@acme/alpha": "file:../../tmp/e2e-packs/acme-alpha-0.0.0.tgz" } }',
    })
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', packageName: '@acme/omega', skipFormat: true })
    expect({ project: readJson(tree, 'e2e/alpha/project.json'), pkg: readJson(tree, 'e2e/alpha/package.json') }).toEqual({
      project: { name: 'e2e-alpha', targets: { e2e: {} }, implicitDependencies: ['alpha'] },
      pkg: { name: '@acme/e2e-omega', dependencies: { '@acme/omega': 'file:../../tmp/e2e-packs/acme-omega-0.0.0.tgz' } },
    })
  })

  it('refuses a project name another project holds, writing nothing', async () => {
    const tree = createMemoryTree(FILES)
    const refusal = await moveGenerator(tree, { project: 'alpha', destination: 'packages', projectName: 'beta', skipFormat: true }).catch(
      (error: Error) => error.message
    )
    expect({ refusal, changes: tree.listChanges() }).toEqual({
      refusal: "Project name already in use: 'beta' is the project at libs/beta",
      changes: [],
    })
  })

  it("refuses a package name another project's package holds, writing nothing", async () => {
    const tree = createMemoryTree(SIBLINGS)
    const refusal = await moveGenerator(tree, {
      project: 'core',
      destination: 'packages',
      newName: 'core-ui',
      projectName: 'zzz',
      skipFormat: true,
    }).catch((error: Error) => error.message)
    expect({ refusal, changes: tree.listChanges() }).toEqual({
      refusal: "Package name already in use: '@acme/core-ui' is the package at libs/core-ui",
      changes: [],
    })
  })

  it('refuses a name whose test project would take the name another project holds, writing nothing', async () => {
    const tree = createMemoryTree({ ...FILES, 'tools/x/project.json': '{ "name": "e2e-omega" }' })
    const refusal = await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true }).catch(
      (error: Error) => error.message
    )
    expect({ refusal, changes: tree.listChanges() }).toEqual({
      refusal: "Project name already in use: 'e2e-omega' is the project at tools/x",
      changes: [],
    })
  })

  it.each([
    ['under a new name', { newName: 'inner' }, 'libs/alpha/inner'],
    ['under its own name', {}, 'libs/alpha/alpha'],
  ])("refuses a destination inside the project's own directory %s, writing nothing", async (_case, names, destination) => {
    const tree = createMemoryTree(FILES)
    const refusal = await moveGenerator(tree, { project: 'alpha', destination: 'libs/alpha', ...names, skipFormat: true }).catch(
      (error: Error) => error.message
    )
    expect({ refusal, changes: tree.listChanges() }).toEqual({
      refusal: `Destination lies inside the project: ${destination}`,
      changes: [],
    })
  })

  it('refuses the current directory as the destination', async () => {
    await expect(moveGenerator(createMemoryTree(FILES), { project: 'alpha', destination: 'libs', skipFormat: true })).rejects.toThrow(
      'Source and destination cannot be the same'
    )
  })

  it('refuses a destination that exists', async () => {
    await expect(
      moveGenerator(createMemoryTree(FILES), { project: 'alpha', destination: 'libs', newName: 'beta', skipFormat: true })
    ).rejects.toThrow('Destination already exists: libs/beta')
  })

  it('formats the files it rewrote and leaves those it only carried over as they were written', async () => {
    const tree = createMemoryTree(FILES, { root: REPO_ROOT })
    await moveGenerator(tree, { project: 'alpha', destination: 'packages/core' })
    expect({
      rewritten: tree.read('tsconfig.base.json', 'utf-8'),
      carried: tree.read('packages/core/alpha/tsconfig.spec.json', 'utf-8'),
    }).toEqual({
      rewritten: expect.stringContaining('"@acme/alpha": ["packages/core/alpha/src/index.ts"]'),
      carried: FILES['libs/alpha/tsconfig.spec.json'],
    })
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(FILES, { root: REPO_ROOT })
    await moveGenerator(tree, { project: 'alpha', destination: 'packages' })
    expect(readJson<{ name: string }>(tree, 'packages/alpha/package.json').name).toBe('@acme/alpha')
  })
})
