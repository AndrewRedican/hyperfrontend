import type { FileTree } from '@hyperfrontend/testing/fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import ts from 'typescript'
import { createFsTree, createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createRunnerWorkspace } from '../../runner/__test-utils__/workspace'
import { readJson } from '../shared/tree'
import { libraryGenerator, planLibrary } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const ROOT_FILES = {
  'package.json':
    '{ "name": "@acme/monorepo", "license": "MIT", "repository": { "type": "git", "url": "git+https://example.test/acme.git" } }',
  'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@acme/zeta": ["libs/zeta/src/index.ts"] } } }',
}

/** A workspace whose own tooling offers a `make-publishable` that records what it was given. */
const PUBLISHING: FileTree = {
  '.gitignore': 'node_modules\n',
  'hf.json': {},
  'package.json': { name: '@acme/monorepo', private: true },
  'tsconfig.base.json': { compilerOptions: { paths: {} } },
  'tools/local/package.json': { name: '@acme/local', private: true, generators: './generators.json' },
  'tools/local/generators.json': { generators: { 'make-publishable': { factory: './publish', schema: './publish.json' } } },
  'tools/local/publish.js': "export default (tree, options) => { tree.write('published.json', JSON.stringify(options)) }\n",
  'tools/local/publish.json': { properties: {} },
}

const publishing = createRunnerWorkspace(PUBLISHING)
afterAll(() => publishing.remove())

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

/**
 * The block comment that heads a module, as TypeScript reads it.
 *
 * @param source - The text of a TypeScript module that holds nothing but its header
 * @returns The description and each tag with the text after it
 */
function headerOf(source: string): { description: string | undefined; tags: string[][] } {
  const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true)
  const [header] = ts.getJSDocCommentsAndTags(file.endOfFileToken).filter(ts.isJSDoc) as [ts.JSDoc]
  return {
    description: ts.getTextOfJSDocComment(header.comment),
    tags: (header.tags ?? []).map((tag) => [tag.tagName.text, ts.getTextOfJSDocComment(tag.comment) ?? '']),
  }
}

describe('planLibrary', () => {
  it('settles the names from the root manifest and the defaults', () => {
    expect(planLibrary(createMemoryTree(ROOT_FILES), { name: 'MyLib' })).toEqual({
      name: 'my-lib',
      projectName: 'my-lib',
      packageName: '@acme/my-lib',
      projectRoot: 'libs/my-lib',
      description: 'MyLib library.',
      tags: [],
      offsetFromRoot: '../../',
    })
  })

  it('takes the directory, the scope without its @, the project name, the package name, the description and the tags as given', () => {
    expect(
      planLibrary(createMemoryTree(ROOT_FILES), {
        name: 'data',
        directory: 'libs/utils',
        scope: 'other',
        projectName: 'lib-data-utils',
        packageName: '@other/data-utils',
        description: 'Data.',
        tags: ['type:util'],
      })
    ).toEqual({
      name: 'data',
      projectName: 'lib-data-utils',
      packageName: '@other/data-utils',
      projectRoot: 'libs/utils/data',
      description: 'Data.',
      tags: ['type:util'],
      offsetFromRoot: '../../../',
    })
  })

  it('names the package without a scope where the root manifest has none and an empty scope is given', () => {
    expect(planLibrary(createMemoryTree({ 'package.json': '{ "name": "monorepo" }' }), { name: 'core', scope: '' }).packageName).toBe(
      'core'
    )
  })
})

describe('libraryGenerator', () => {
  it('writes the files of the library', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual([
      'libs/alpha/lint.config.ts',
      'libs/alpha/package.json',
      'libs/alpha/project.json',
      'libs/alpha/README.md',
      'libs/alpha/src/index.ts',
      'libs/alpha/test.config.ts',
      'libs/alpha/tsconfig.json',
      'libs/alpha/tsconfig.lib.json',
      'libs/alpha/tsconfig.spec.json',
      'tsconfig.base.json',
    ])
  })

  it('writes a README that names the package and what it is for, with no way to install a package that is not published', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', description: 'Alpha.', skipFormat: true })
    expect(tree.read('libs/alpha/README.md', 'utf-8')).toBe('# @acme/alpha\n\nAlpha.\n')
  })

  it('writes an entry that parses whatever the description holds, the end of a comment and a line break included', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', description: 'Globs such as src/**/*.ts\nand "more" of it\'s kind.', skipFormat: true })
    const entry = tree.read('libs/alpha/src/index.ts', 'utf-8') as string
    expect({ errors: syntaxErrors(entry), entry }).toEqual({
      errors: [],
      entry: '/**\n * Globs such as src/**\\/*.ts\n * and "more" of it\'s kind.\n *\n * @module @acme/alpha\n */\n',
    })
  })

  it('writes an entry whose header keeps a description that opens its lines with an at sign, and gains no tag from it', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', description: "@acme/core's test helpers.\n@module evil", skipFormat: true })
    // note: TypeScript reads the scope of the package named after the module tag as a tag of its own
    expect(headerOf(tree.read('libs/alpha/src/index.ts', 'utf-8') as string)).toEqual({
      description: "`@acme/core`'s test helpers.\n`@module` evil",
      tags: [
        ['module', ''],
        ['acme', '/alpha'],
      ],
    })
  })

  it('keeps the description as given in the manifests and the README', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', description: 'Globs such as src/**/*.ts', skipFormat: true })
    expect({
      project: readJson<{ description: string }>(tree, 'libs/alpha/project.json').description,
      pkg: readJson<{ description: string }>(tree, 'libs/alpha/package.json').description,
      readme: tree.read('libs/alpha/README.md', 'utf-8'),
    }).toEqual({
      project: 'Globs such as src/**/*.ts',
      pkg: 'Globs such as src/**/*.ts',
      readme: '# @acme/alpha\n\nGlobs such as src/**/*.ts\n',
    })
  })

  it.each([
    ['a quote', "@acme/it's"],
    ['a line break', '@acme/two\nlines'],
    ['the end of a comment', '@acme/a*/b'],
  ])('refuses a package name that holds %s, which no file it writes could carry, and writes nothing', async (_what, packageName) => {
    const tree = createMemoryTree(ROOT_FILES)
    const refusal = await libraryGenerator(tree, { name: 'alpha', packageName, skipFormat: true }).catch((error: Error) => error.message)
    expect({ refusal, changes: tree.listChanges() }).toEqual({ refusal: expect.stringMatching(/^Invalid package name /), changes: [] })
  })

  it('writes a private manifest with the licence the root manifest states, and no repository, which the build writes', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', description: 'Alpha.', skipFormat: true })
    expect(readJson(tree, 'libs/alpha/package.json')).toEqual({
      name: '@acme/alpha',
      version: '0.0.0',
      description: 'Alpha.',
      license: 'MIT',
      type: 'module',
      private: true,
      exports: { '.': './src/index.js', './package.json': './package.json' },
    })
  })

  it('writes a manifest without a licence where the root manifest states none', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'package.json': '{ "name": "@acme/monorepo" }' })
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(readJson(tree, 'libs/alpha/package.json')).toEqual({
      name: '@acme/alpha',
      version: '0.0.0',
      description: 'Alpha library.',
      type: 'module',
      private: true,
      exports: { '.': './src/index.js', './package.json': './package.json' },
    })
  })

  it('writes no repository where the root manifest states one as a string', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'package.json': '{ "name": "@acme/monorepo", "repository": "github:acme/monorepo" }' })
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(readJson(tree, 'libs/alpha/package.json')).not.toHaveProperty('repository')
  })

  it('writes the project with its tags and the targets the workspace defaults configure', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', tags: ['type:util'], skipFormat: true })
    expect(readJson(tree, 'libs/alpha/project.json')).toEqual({
      name: 'alpha',
      description: 'Alpha library.',
      sourceRoot: '{projectRoot}/src',
      projectType: 'library',
      tags: ['type:util'],
      targets: { typecheck: {}, test: {}, build: { options: { esm: {}, cjs: {} } } },
    })
  })

  it('adds the alias of the package among the others', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@acme/alpha': ['libs/alpha/src/index.ts'],
      '@acme/zeta': ['libs/zeta/src/index.ts'],
    })
  })

  it('points the configuration files at the root from the library depth', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'data', directory: 'libs/utils', skipFormat: true })
    expect({
      lint: tree.read('libs/utils/data/lint.config.ts', 'utf-8'),
      tsconfig: readJson<{ extends: string }>(tree, 'libs/utils/data/tsconfig.json').extends,
    }).toEqual({ lint: expect.stringContaining("from '../../../lint.base.config.ts'"), tsconfig: '../../../tsconfig.base.json' })
  })

  it('refuses a directory that is already there, so no library is written over', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'libs/core/src/index.ts': 'export const kept = true\n' })
    await expect(libraryGenerator(tree, { name: 'core', skipFormat: true })).rejects.toThrow('Destination already exists: libs/core')
  })

  it('leaves the files of a directory it refuses as they were', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'libs/core/src/index.ts': 'export const kept = true\n' })
    await libraryGenerator(tree, { name: 'core', skipFormat: true }).catch(() => undefined)
    expect(tree.listChanges()).toEqual([])
  })

  it('refuses a project name another project already holds', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'apps/core/project.json': '{ "name": "core", "projectType": "application" }' })
    await expect(libraryGenerator(tree, { name: 'core', skipFormat: true })).rejects.toThrow(
      "Project name already in use: 'core' is the project at apps/core"
    )
  })

  it("refuses a package name another project's package holds, so no alias is written over", async () => {
    const tree = createMemoryTree({
      ...ROOT_FILES,
      'libs/zeta/project.json': '{ "name": "zeta" }',
      'libs/zeta/package.json': '{ "name": "@acme/zeta" }',
    })
    const refusal = await libraryGenerator(tree, { name: 'zeta', directory: 'packages', projectName: 'zeta-two', skipFormat: true }).catch(
      (error: Error) => error.message
    )
    expect({ refusal, changes: tree.listChanges() }).toEqual({
      refusal: "Package name already in use: '@acme/zeta' is the package at libs/zeta",
      changes: [],
    })
  })

  it('hands a publishable library to the generator named make-publishable with the options it takes', async () => {
    const tree = createFsTree(publishing.path)
    await libraryGenerator(tree, { name: 'gamma', publishable: true, keywords: ['k'], formats: ['esm'], skipFormat: true })
    expect(readJson(tree, 'published.json')).toEqual({ project: 'gamma', keywords: ['k'], formats: ['esm'], skipFormat: true })
  })

  it('hands on no option it was not given', async () => {
    const tree = createFsTree(publishing.path)
    await libraryGenerator(tree, { name: 'delta', publishable: true, skipFormat: true })
    expect(readJson(tree, 'published.json')).toEqual({ project: 'delta', skipFormat: true })
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(ROOT_FILES, { root: REPO_ROOT })
    await libraryGenerator(tree, { name: 'alpha' })
    expect(tree.read('libs/alpha/lint.config.ts', 'utf-8')).toContain("import baseConfig from '../../lint.base.config.ts'")
  })
})
