import { join } from 'node:path'
import ts from 'typescript'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { serviceGenerator } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

/** Where an installed kernel states its version. */
const INSTALLED_KERNEL = 'node_modules/@hyperfrontend/server/package.json'

/** A workspace with nothing in it that provides the kernel. */
const BARE_FILES = {
  'package.json': '{ "name": "@acme/monorepo", "version": "9.9.9" }',
  'tsconfig.base.json': '{ "compilerOptions": { "paths": {} } }',
}

const ROOT_FILES = { ...BARE_FILES, [INSTALLED_KERNEL]: '{ "name": "@hyperfrontend/server", "version": "0.2.0" }' }

/** What a workspace that provides no usable kernel is told. */
const NO_KERNEL =
  'a service is written on @hyperfrontend/server 0.2.0 or later, which this workspace does not provide: npm install @hyperfrontend/server'

/**
 * A base tsconfig whose alias for the kernel names a module.
 *
 * @param entry - The module, as the alias writes it
 * @returns The text of the file
 */
function aliasing(entry: string): string {
  return `{ "compilerOptions": { "paths": { "@hyperfrontend/server": ["${entry}"] } } }`
}

/**
 * The syntax errors TypeScript reports for a source text.
 *
 * @param source - The text of a TypeScript module
 * @returns The messages, none for a module that parses
 */
function syntaxErrors(source: string): string[] {
  const { diagnostics = [] } = ts.transpileModule(source, { reportDiagnostics: true })
  return diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '))
}

describe('serviceGenerator', () => {
  it('writes the files of the service, its configuration among them, and no alias for it', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(
      tree
        .listChanges()
        .map((change) => change.path)
        .sort()
    ).toEqual([
      'apps/api/lint.config.ts',
      'apps/api/package.json',
      'apps/api/project.json',
      'apps/api/service.config.ts',
      'apps/api/src/main.ts',
      'apps/api/src/service.spec.ts',
      'apps/api/src/service.ts',
      'apps/api/test.config.ts',
      'apps/api/tsconfig.json',
      'apps/api/tsconfig.lib.json',
      'apps/api/tsconfig.spec.json',
    ])
  })

  it('states the kind in the project, with its description and its tags', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', tags: ['type:service'], skipFormat: true })
    expect(readJson(tree, 'apps/api/project.json')).toEqual({
      name: 'api',
      description: 'Api service.',
      sourceRoot: '{projectRoot}/src',
      projectType: 'service',
      tags: ['type:service'],
      targets: expect.any(Object),
    })
  })

  it('writes the build and dev targets', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(tree.read('apps/api/project.json', 'utf-8')).toContain(
      [
        '  "targets": {',
        '    "build": {',
        '      "executor": "@hyperfrontend/workspace:service"',
        '    },',
        '    "dev": {',
        '      "command": "node --import @hyperfrontend/workspace/hooks \\"{projectRoot}/src/main.ts\\""',
        '    },',
        '    "typecheck": {},',
        '    "test": {}',
        '  }',
      ].join('\n')
    )
  })

  it('states the kind where the directory is not the applications one', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'jobs', directory: 'services', projectName: 'service-jobs', skipFormat: true })
    expect(readJson(tree, 'services/jobs/project.json')).toEqual(expect.objectContaining({ name: 'service-jobs', projectType: 'service' }))
  })

  it('writes a private ES module manifest under the scope of the root manifest, with the kernel as its one dependency', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', description: 'The API.', skipFormat: true })
    expect(readJson(tree, 'apps/api/package.json')).toEqual({
      name: '@acme/api',
      version: '0.0.0',
      description: 'The API.',
      type: 'module',
      private: true,
      dependencies: { '@hyperfrontend/server': '0.2.0' },
    })
  })

  it('depends on the kernel at the version the workspace installs', async () => {
    const tree = createMemoryTree({ ...BARE_FILES, [INSTALLED_KERNEL]: '{ "name": "@hyperfrontend/server", "version": "1.4.2" }' })
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(readJson<{ dependencies: object }>(tree, 'apps/api/package.json').dependencies).toEqual({ '@hyperfrontend/server': '1.4.2' })
  })

  it('takes the version from the project behind an alias', async () => {
    const tree = createMemoryTree({
      ...ROOT_FILES,
      'tsconfig.base.json': aliasing('./libs/server/src/index.ts'),
      'libs/server/package.json': '{ "name": "@hyperfrontend/server", "version": "0.3.0-beta.1" }',
    })
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(readJson<{ dependencies: object }>(tree, 'apps/api/package.json').dependencies).toEqual({
      '@hyperfrontend/server': '0.3.0-beta.1',
    })
  })

  it('takes the installed version where no project is behind the alias, the manifest of the workspace not being one', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'tsconfig.base.json': aliasing('vendor/server/index.ts') })
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(readJson<{ dependencies: object }>(tree, 'apps/api/package.json').dependencies).toEqual({ '@hyperfrontend/server': '0.2.0' })
  })

  it('takes the installed version where the alias is absolute, the manifest of the workspace not being the project behind it', async () => {
    const tree = createMemoryTree({
      ...ROOT_FILES,
      'package.json': '{ "name": "@hyperfrontend/server", "version": "9.9.9" }',
      'tsconfig.base.json': aliasing('/elsewhere/kernel/libs/server/src/index.ts'),
    })
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(readJson<{ dependencies: object }>(tree, 'apps/api/package.json').dependencies).toEqual({ '@hyperfrontend/server': '0.2.0' })
  })

  it('takes the installed version where the alias climbs out of the workspace, reading nothing out there', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'tsconfig.base.json': aliasing('../kernel/libs/server/src/index.ts') })
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(readJson<{ dependencies: object }>(tree, 'apps/api/package.json').dependencies).toEqual({ '@hyperfrontend/server': '0.2.0' })
  })

  it('passes over a manifest above the aliased module that names another package', async () => {
    const tree = createMemoryTree({
      ...ROOT_FILES,
      'tsconfig.base.json': aliasing('libs/server/src/index.ts'),
      'libs/package.json': '{ "name": "@acme/libraries", "version": "9.9.9" }',
    })
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(readJson<{ dependencies: object }>(tree, 'apps/api/package.json').dependencies).toEqual({ '@hyperfrontend/server': '0.2.0' })
  })

  it('takes the installed version where the workspace has no base tsconfig', async () => {
    const tree = createMemoryTree({ 'package.json': BARE_FILES['package.json'], [INSTALLED_KERNEL]: ROOT_FILES[INSTALLED_KERNEL] })
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(readJson<{ dependencies: object }>(tree, 'apps/api/package.json').dependencies).toEqual({ '@hyperfrontend/server': '0.2.0' })
  })

  it('refuses a workspace without the kernel', async () => {
    const tree = createMemoryTree(BARE_FILES)
    const refusal = await serviceGenerator(tree, { name: 'api', skipFormat: true }).catch((error: Error) => error.message)
    expect({ refusal, changes: tree.listChanges() }).toEqual({ refusal: NO_KERNEL, changes: [] })
  })

  it.each([
    ['the release before the runner', '0.1.9'],
    ['a prerelease of the first release with the runner', '0.2.0-rc.1'],
  ])('refuses a kernel below 0.2.0: %s', async (_what, version) => {
    const tree = createMemoryTree({ ...BARE_FILES, [INSTALLED_KERNEL]: `{ "name": "@hyperfrontend/server", "version": "${version}" }` })
    const refusal = await serviceGenerator(tree, { name: 'api', skipFormat: true }).catch((error: Error) => error.message)
    expect({ refusal, changes: tree.listChanges() }).toEqual({ refusal: NO_KERNEL, changes: [] })
  })

  it('refuses a kernel whose manifest states no version', async () => {
    const tree = createMemoryTree({ ...BARE_FILES, [INSTALLED_KERNEL]: '{ "name": "@hyperfrontend/server" }' })
    await expect(serviceGenerator(tree, { name: 'api', skipFormat: true })).rejects.toThrow(NO_KERNEL)
  })

  it('refuses a kernel below 0.2.0 behind an alias, whatever is installed', async () => {
    const tree = createMemoryTree({
      ...ROOT_FILES,
      'tsconfig.base.json': aliasing('libs/server/src/index.ts'),
      'libs/server/package.json': '{ "name": "@hyperfrontend/server", "version": "0.1.0" }',
    })
    await expect(serviceGenerator(tree, { name: 'api', skipFormat: true })).rejects.toThrow(
      "a service is written on @hyperfrontend/server 0.2.0 or later, and libs/server/package.json, which the workspace's alias for it names, states an earlier version or none"
    )
  })

  it('writes a configuration with an empty immutable section', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(tree.read('apps/api/service.config.ts', 'utf-8')).toBe(
      '/** The configuration the api service is built with: the immutable section holds the structural settings that are fixed when the service is built. */\nexport default { immutable: {} }\n'
    )
  })

  it('type-checks the configuration with the sources, and the specs and the test configuration apart', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect({
      lib: readJson<{ include: string[] }>(tree, 'apps/api/tsconfig.lib.json').include,
      spec: readJson<{ include: string[] }>(tree, 'apps/api/tsconfig.spec.json').include,
    }).toEqual({
      lib: ['src/**/*.ts', 'service.config.ts'],
      spec: ['test.config.ts', 'src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.d.ts'],
    })
  })

  it('writes a main that only runs the service', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', projectName: 'service-api', skipFormat: true })
    expect(tree.read('apps/api/src/main.ts', 'utf-8')).toBe(
      [
        '/**',
        ' * Api service.',
        ' *',
        ' * @module service-api',
        ' */',
        '',
        "import { runService } from '@hyperfrontend/server'",
        "import { service } from './service'",
        '',
        'void runService(service)',
        '',
      ].join('\n')
    )
  })

  it('excludes the main from coverage', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(tree.read('apps/api/test.config.ts', 'utf-8')).toMatch(/\n {2}\/\/ why: [^\n]+\n {2}coverageExclude: \['src\/main\.ts'\],\n/)
  })

  it('writes a service that hands the immutable section of its configuration to the runner', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(tree.read('apps/api/src/service.ts', 'utf-8')).toMatch(
      /import config from '\.\.\/service\.config'[\s\S]*export const service = defineService\(\{[\s\S]*\n {2}immutable: config\.immutable,\n/
    )
  })

  it('writes sources and a spec that parse, the spec named after the project', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', projectName: 'service-api', skipFormat: true })
    const spec = tree.read('apps/api/src/service.spec.ts', 'utf-8') as string
    expect({ errors: [spec, tree.read('apps/api/src/service.ts', 'utf-8') as string].flatMap(syntaxErrors), spec }).toEqual({
      errors: [],
      spec: expect.stringContaining("describe('service-api', () => {"),
    })
  })

  it('points the configuration files at the root from the service depth', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', directory: 'services/internal', skipFormat: true })
    expect({
      lint: tree.read('services/internal/api/lint.config.ts', 'utf-8'),
      tsconfig: readJson<{ extends: string }>(tree, 'services/internal/api/tsconfig.json').extends,
    }).toEqual({ lint: expect.stringContaining("from '../../../lint.base.config.ts'"), tsconfig: '../../../tsconfig.base.json' })
  })

  it('writes an entry that parses whatever the description holds, the end of a comment and a line break included', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', description: 'Serves */ things\nand "more" of it\'s kind.', skipFormat: true })
    const entry = tree.read('apps/api/src/main.ts', 'utf-8') as string
    expect({ errors: syntaxErrors(entry), header: entry.slice(0, entry.indexOf('@module')) }).toEqual({
      errors: [],
      header: '/**\n * Serves *\\/ things\n * and "more" of it\'s kind.\n *\n * ',
    })
  })

  it.each([
    ['a quote', "it's"],
    ['a line break', 'two\nlines'],
    ['the end of a comment', 'a*/b'],
  ])('refuses a project name that holds %s, which no file it writes could carry, and writes nothing', async (_what, projectName) => {
    const tree = createMemoryTree(ROOT_FILES)
    const refusal = await serviceGenerator(tree, { name: 'api', projectName, skipFormat: true }).catch((error: Error) => error.message)
    expect({ refusal, changes: tree.listChanges() }).toEqual({ refusal: expect.stringMatching(/^Invalid project name /), changes: [] })
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(ROOT_FILES, { root: REPO_ROOT })
    await serviceGenerator(tree, { name: 'api', tags: ['type:service'] })
    expect(tree.read('apps/api/project.json', 'utf-8')).toContain('"tags": ["type:service"]')
  })

  it('refuses a directory that is already there, so no project is written over', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'libs/core/project.json': '{ "name": "core", "projectType": "library" }' })
    await expect(serviceGenerator(tree, { name: 'core', directory: 'libs', projectName: 'core-next', skipFormat: true })).rejects.toThrow(
      'Destination already exists: libs/core'
    )
  })

  it('refuses a project name another project already holds', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'libs/web/project.json': '{ "name": "web", "projectType": "library" }' })
    await expect(serviceGenerator(tree, { name: 'web', skipFormat: true })).rejects.toThrow(
      "Project name already in use: 'web' is the project at libs/web"
    )
  })
})
