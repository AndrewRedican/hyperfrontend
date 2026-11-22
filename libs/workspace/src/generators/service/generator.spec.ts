import { join } from 'node:path'
import ts from 'typescript'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { serviceGenerator } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const ROOT_FILES = {
  'package.json': '{ "name": "@acme/monorepo" }',
  'tsconfig.base.json': '{ "compilerOptions": { "paths": {} } }',
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
      'apps/api/src/main.spec.ts',
      'apps/api/src/main.ts',
      'apps/api/test.config.ts',
      'apps/api/tsconfig.json',
      'apps/api/tsconfig.lib.json',
      'apps/api/tsconfig.spec.json',
    ])
  })

  it('states the kind in the project, with the typecheck and test targets the workspace defaults configure', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', tags: ['type:service'], skipFormat: true })
    expect(readJson(tree, 'apps/api/project.json')).toEqual({
      name: 'api',
      description: 'Api service.',
      sourceRoot: '{projectRoot}/src',
      projectType: 'service',
      tags: ['type:service'],
      targets: { typecheck: {}, test: {} },
    })
  })

  it('states the kind where the directory is not the applications one', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'jobs', directory: 'services', projectName: 'service-jobs', skipFormat: true })
    expect(readJson(tree, 'services/jobs/project.json')).toEqual(expect.objectContaining({ name: 'service-jobs', projectType: 'service' }))
  })

  it('writes a private ES module manifest under the scope of the root manifest', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', description: 'The API.', skipFormat: true })
    expect(readJson(tree, 'apps/api/package.json')).toEqual({
      name: '@acme/api',
      version: '0.0.0',
      description: 'The API.',
      type: 'module',
      private: true,
    })
  })

  it('writes a configuration that exports one plain object and imports nothing', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', skipFormat: true })
    expect(tree.read('apps/api/service.config.ts', 'utf-8')).toBe(
      '/** The configuration the api service runs with. */\nexport default {}\n'
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

  it('writes a spec that passes on the entry module as written, so the full-coverage gate measures every source', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await serviceGenerator(tree, { name: 'api', projectName: 'service-api', skipFormat: true })
    expect({ entry: tree.read('apps/api/src/main.ts', 'utf-8'), spec: tree.read('apps/api/src/main.spec.ts', 'utf-8') }).toEqual({
      entry: expect.stringContaining("return 'service-api is running'"),
      spec: expect.stringMatching(/import \{ main \} from '\.\/main'[\s\S]*expect\(main\(\)\)\.toBe\('service-api is running'\)/),
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
