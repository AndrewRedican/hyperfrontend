import { join } from 'node:path'
import ts from 'typescript'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { applicationGenerator } from './generator'

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

describe('applicationGenerator', () => {
  it('writes the files of the application, and no alias for it', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', skipFormat: true })
    expect(
      tree
        .listChanges()
        .map((change) => change.path)
        .sort()
    ).toEqual([
      'apps/web/lint.config.ts',
      'apps/web/package.json',
      'apps/web/project.json',
      'apps/web/src/main.spec.ts',
      'apps/web/src/main.ts',
      'apps/web/test.config.ts',
      'apps/web/tsconfig.json',
      'apps/web/tsconfig.lib.json',
      'apps/web/tsconfig.spec.json',
    ])
  })

  it('states the kind in the project, with the typecheck and test targets the workspace defaults configure', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', tags: ['type:app'], skipFormat: true })
    expect(readJson(tree, 'apps/web/project.json')).toEqual({
      name: 'web',
      description: 'Web application.',
      sourceRoot: '{projectRoot}/src',
      projectType: 'application',
      tags: ['type:app'],
      targets: { typecheck: {}, test: {} },
    })
  })

  it('states the kind where the directory is not the applications one', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', directory: 'sites', projectName: 'site-web', skipFormat: true })
    expect(readJson(tree, 'sites/web/project.json')).toEqual(expect.objectContaining({ name: 'site-web', projectType: 'application' }))
  })

  it('writes a private ES module manifest under the scope of the root manifest', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', description: 'The site.', skipFormat: true })
    expect(readJson(tree, 'apps/web/package.json')).toEqual({
      name: '@acme/web',
      version: '0.0.0',
      description: 'The site.',
      type: 'module',
      private: true,
    })
  })

  it('type-checks the sources through one configuration and the specs and the test configuration through the other', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', skipFormat: true })
    expect({
      lib: readJson<{ include: string[] }>(tree, 'apps/web/tsconfig.lib.json').include,
      spec: readJson<{ include: string[] }>(tree, 'apps/web/tsconfig.spec.json').include,
    }).toEqual({ lib: ['src/**/*.ts'], spec: ['test.config.ts', 'src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.d.ts'] })
  })

  it('writes a spec that passes on the entry module as written, so the full-coverage gate measures every source', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', projectName: 'site-web', skipFormat: true })
    expect({ entry: tree.read('apps/web/src/main.ts', 'utf-8'), spec: tree.read('apps/web/src/main.spec.ts', 'utf-8') }).toEqual({
      entry: expect.stringContaining("return 'site-web is running'"),
      spec: expect.stringMatching(/import \{ main \} from '\.\/main'[\s\S]*expect\(main\(\)\)\.toBe\('site-web is running'\)/),
    })
  })

  it('points the configuration files at the root from the application depth', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', directory: 'apps/sites', skipFormat: true })
    expect({
      lint: tree.read('apps/sites/web/lint.config.ts', 'utf-8'),
      tsconfig: readJson<{ extends: string }>(tree, 'apps/sites/web/tsconfig.json').extends,
    }).toEqual({ lint: expect.stringContaining("from '../../../lint.base.config.ts'"), tsconfig: '../../../tsconfig.base.json' })
  })

  it('writes an entry that parses whatever the description holds, the end of a comment and a line break included', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await applicationGenerator(tree, { name: 'web', description: 'Serves */ things\nand "more" of it\'s kind.', skipFormat: true })
    const entry = tree.read('apps/web/src/main.ts', 'utf-8') as string
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
    const refusal = await applicationGenerator(tree, { name: 'web', projectName, skipFormat: true }).catch((error: Error) => error.message)
    expect({ refusal, changes: tree.listChanges() }).toEqual({ refusal: expect.stringMatching(/^Invalid project name /), changes: [] })
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(ROOT_FILES, { root: REPO_ROOT })
    await applicationGenerator(tree, { name: 'web', tags: ['type:app'] })
    expect(tree.read('apps/web/project.json', 'utf-8')).toContain('"tags": ["type:app"]')
  })

  it('refuses a directory that is already there, so no project is written over', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'libs/core/project.json': '{ "name": "core", "projectType": "library" }' })
    await expect(
      applicationGenerator(tree, { name: 'core', directory: 'libs', projectName: 'core-next', skipFormat: true })
    ).rejects.toThrow('Destination already exists: libs/core')
  })

  it('refuses a project name another project already holds', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'libs/web/project.json': '{ "name": "web", "projectType": "library" }' })
    await expect(applicationGenerator(tree, { name: 'web', skipFormat: true })).rejects.toThrow(
      "Project name already in use: 'web' is the project at libs/web"
    )
  })
})
