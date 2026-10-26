/**
 * The fixture workspace the graph specs analyse, and the scenarios that change it: each scenario
 * is a base tree and a head tree, planted as two commits of a temporary repository so a spec can
 * ask what a change selects. Written as code so no test material rests in the tree.
 *
 * @module graph/__test-utils__/workspace-fixtures
 */

import type { FileTree, TempDir } from '@hyperfrontend/testing/fs'
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, freeze, fromEntries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** One scenario: a workspace before and after a change. */
export interface WorkspaceFixture {
  /** The scenario's name, as the plan's acceptance list names it. */
  readonly name: string
  /** What the scenario exercises. */
  readonly description: string
  /** The tree at the base revision. */
  readonly base: FileTree
  /** The tree at the head revision. */
  readonly head: FileTree
  /** The change as `git diff --name-status -M` writes it, one entry per line, sorted. */
  readonly expectedChanges: readonly string[]
}

/** A fixture planted as a repository with two commits. */
export interface PlantedFixture {
  /** The repository root. */
  readonly root: string
  /** The base commit. */
  readonly base: string
  /** The head commit. */
  readonly head: string
  /** Deletes the repository. */
  remove(): void
}

/** The identity fixture commits carry. */
const IDENTITY = freeze({
  GIT_AUTHOR_NAME: 'fixture',
  GIT_AUTHOR_EMAIL: 'fixture@localhost',
  GIT_COMMITTER_NAME: 'fixture',
  GIT_COMMITTER_EMAIL: 'fixture@localhost',
})

/**
 * A JSON file's text.
 *
 * @param value - What the file holds
 * @returns Pretty-printed JSON with a trailing newline
 */
function json(value: unknown): string {
  return `${stringify(value, null, 2)}\n`
}

/**
 * The `package.json` and `project.json` of a fixture library.
 *
 * @param root - The library root, workspace-relative
 * @param name - The package name
 * @param entries - The export subpaths beyond `.`
 * @returns The two files
 */
function library(root: string, name: string, entries: readonly string[] = []): FileTree {
  const exports: Record<string, string> = { '.': './src/index.js' }
  for (const entry of entries) exports[`./${entry}`] = `./src/${entry}/index.js`
  return {
    [posix.join(root, 'package.json')]: json({ name, version: '0.0.0', exports }),
    [posix.join(root, 'project.json')]: json({
      name: `lib-${posix.basename(root)}`,
      projectType: 'library',
      sourceRoot: posix.join(root, 'src'),
      tags: ['type:util'],
      targets: { build: {}, test: {}, typecheck: {}, lint: {} },
    }),
  }
}

/**
 * The fixture workspace at its base: two libraries with secondary entries, a consumer of one
 * entry, a spec-only dependency, a type-only dependency, a side-effect import, a non-literal
 * dynamic import, an `export *` barrel, a cross-project cycle, and a root project reading a
 * `{workspaceRoot}/` input.
 */
export const FIXTURE_WORKSPACE: FileTree = freeze({
  'package.json': json({ name: '@fixture/workspace', private: true, devDependencies: { typescript: '5.0.0' } }),
  'package-lock.json': json({ name: '@fixture/workspace', lockfileVersion: 3, packages: { '': { name: '@fixture/workspace' } } }),
  'nx.json': json({
    namedInputs: {
      default: ['{projectRoot}/**/*'],
      production: [
        'default',
        '!{projectRoot}/lint.config.ts',
        '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
        '!{projectRoot}/tsconfig.spec.json',
        '!{projectRoot}/test.config.ts',
      ],
    },
    targetDefaults: {
      build: { cache: true, inputs: ['production', '^production'], executor: '@fixture/tooling:build' },
      typecheck: { cache: true, inputs: ['default', '^production'] },
      test: { inputs: ['default', '^production'] },
      lint: { cache: true, inputs: ['default', '{workspaceRoot}/lint.base.config.ts'] },
    },
  }),
  'tsconfig.base.json': json({
    compilerOptions: {
      paths: {
        '@fixture/alpha': ['libs/alpha/src/index.ts'],
        '@fixture/alpha/extra': ['libs/alpha/src/extra/index.ts'],
        '@fixture/beta': ['libs/beta/src/index.ts'],
        '@fixture/beta/side': ['libs/beta/src/side/index.ts'],
        '@fixture/testing': ['libs/testing/src/index.ts'],
        '@fixture/cycle-a': ['libs/cycle-a/src/index.ts'],
        '@fixture/cycle-b': ['libs/cycle-b/src/index.ts'],
        '@fixture/tooling': ['tools/tooling/src/index.ts'],
      },
    },
  }),
  'lint.base.config.ts': 'export default []\n',
  'project.json': json({ name: 'workspace', projectType: 'application', targets: { docs: { inputs: ['{workspaceRoot}/docs/**/*'] } } }),
  'docs/guide.md': '# Guide\n',
  ...library('libs/alpha', '@fixture/alpha', ['extra']),
  'libs/alpha/src/index.ts': "export { core } from './core'\nexport type { AlphaOptions } from './types'\n",
  'libs/alpha/src/core.ts': "import { shared } from './shared'\nexport const core = (): number => shared + 1\n",
  'libs/alpha/src/types.ts': 'export interface AlphaOptions {\n  level: number\n}\n',
  'libs/alpha/src/shared.ts': 'export const shared = 41\n',
  'libs/alpha/src/extra/index.ts': "export { extra } from './extra-impl'\n",
  'libs/alpha/src/extra/extra-impl.ts': "import { shared } from '../shared'\nexport const extra = (): number => shared * 2\n",
  'libs/alpha/src/core.spec.ts': "import { check } from '@fixture/testing'\nimport { core } from './core'\ncheck(core() === 42)\n",
  'libs/alpha/test.config.ts': "import { configure } from '@fixture/testing'\nexport default configure()\n",
  ...library('libs/beta', '@fixture/beta', ['side']),
  'libs/beta/src/index.ts':
    "import type { AlphaOptions } from '@fixture/alpha'\nexport * from './all'\nexport const level = (options: AlphaOptions): number => options.level\n",
  'libs/beta/src/all.ts': 'export const beta = 2\n',
  'libs/beta/src/side/index.ts': "import '@fixture/alpha/extra'\nexport const side = 3\n",
  ...library('libs/testing', '@fixture/testing'),
  'libs/testing/src/index.ts':
    'export const check = (ok: boolean): void => {\n  if (!ok) throw new Error()\n}\nexport const configure = (): object => ({})\n',
  ...library('libs/cycle-a', '@fixture/cycle-a'),
  'libs/cycle-a/src/index.ts': "import { b } from '@fixture/cycle-b'\nexport const a = (): number => b() + 1\n",
  ...library('libs/cycle-b', '@fixture/cycle-b'),
  'libs/cycle-b/src/index.ts': "import type { a } from '@fixture/cycle-a'\nexport const b = (): number => 1\nexport type A = typeof a\n",
  ...library('tools/tooling', '@fixture/tooling'),
  'tools/tooling/src/index.ts': 'export const build = (): void => undefined\n',
  'apps/consumer/package.json': json({ name: '@fixture/consumer', private: true }),
  'apps/consumer/project.json': json({
    name: 'app-consumer',
    projectType: 'application',
    sourceRoot: 'apps/consumer/src',
    tags: ['type:app'],
    targets: { build: {}, test: {}, typecheck: {}, lint: {} },
  }),
  'apps/consumer/src/main.ts': "import { extra } from '@fixture/alpha/extra'\nexport const main = (): number => extra()\n",
  'apps/consumer/src/loader.ts': 'export const load = (name: string): Promise<unknown> => import(name)\n',
})

/**
 * A tree with one file replaced or added.
 *
 * @param tree - The tree to start from
 * @param path - The file to replace or add
 * @param content - Its new content
 * @returns A new tree
 */
function edit(tree: FileTree, path: string, content: string): FileTree {
  return { ...tree, [path]: content }
}

/**
 * A tree without one file.
 *
 * @param tree - The tree to start from
 * @param path - The file to leave out
 * @returns A new tree
 */
function without(tree: FileTree, path: string): FileTree {
  return fromEntries(entries(tree).filter(([key]) => key !== path))
}

/**
 * A scenario over the fixture workspace.
 *
 * @param name - What the scenario is called in the acceptance list
 * @param description - What it exercises
 * @param head - The tree after the change
 * @param expectedChanges - The diff as `git diff --name-status -M` writes it
 * @returns The fixture
 */
function scenario(name: string, description: string, head: FileTree, expectedChanges: readonly string[]): WorkspaceFixture {
  return { name, description, base: FIXTURE_WORKSPACE, head, expectedChanges }
}

/** The scenarios the affected analysis is held to. */
export const FIXTURES: readonly WorkspaceFixture[] = freeze([
  scenario(
    'unused-entry-edit',
    'alpha core changes; the consumer imports only alpha/extra, so only tasks reading the main entry follow',
    edit(FIXTURE_WORKSPACE, 'libs/alpha/src/core.ts', "import { shared } from './shared'\nexport const core = (): number => shared + 2\n"),
    ['M\tlibs/alpha/src/core.ts']
  ),
  scenario(
    'shared-internal-edit',
    'a file both alpha entries reach changes; every consumer of either entry follows',
    edit(FIXTURE_WORKSPACE, 'libs/alpha/src/shared.ts', 'export const shared = 40\n'),
    ['M\tlibs/alpha/src/shared.ts']
  ),
  scenario(
    'spec-only-dependency-edit',
    'the testing library changes; alpha imports it from a spec and its test config only',
    edit(
      FIXTURE_WORKSPACE,
      'libs/testing/src/index.ts',
      'export const check = (ok: boolean): void => {\n  if (!ok) throw new Error("failed")\n}\nexport const configure = (): object => ({})\n'
    ),
    ['M\tlibs/testing/src/index.ts']
  ),
  scenario(
    'type-only-edit',
    'an alpha type changes; beta imports it as a type only, so its typecheck and build follow and its test does not',
    edit(FIXTURE_WORKSPACE, 'libs/alpha/src/types.ts', 'export interface AlphaOptions {\n  level: number\n  verbose?: boolean\n}\n'),
    ['M\tlibs/alpha/src/types.ts']
  ),
  scenario(
    'side-effect-target-edit',
    'the extra entry beta/side imports for its effect changes; the side-effect importer follows',
    edit(
      FIXTURE_WORKSPACE,
      'libs/alpha/src/extra/extra-impl.ts',
      "import { shared } from '../shared'\nexport const extra = (): number => shared * 3\n"
    ),
    ['M\tlibs/alpha/src/extra/extra-impl.ts']
  ),
  scenario(
    'barrel-target-edit',
    'a file beta re-exports with export * changes; the barrel carries it to every beta consumer',
    edit(FIXTURE_WORKSPACE, 'libs/beta/src/all.ts', 'export const beta = 3\n'),
    ['M\tlibs/beta/src/all.ts']
  ),
  scenario(
    'cycle-edit',
    'one side of the cycle changes; the strongly connected component collapses to one unit',
    edit(
      FIXTURE_WORKSPACE,
      'libs/cycle-b/src/index.ts',
      "import type { a } from '@fixture/cycle-a'\nexport const b = (): number => 2\nexport type A = typeof a\n"
    ),
    ['M\tlibs/cycle-b/src/index.ts']
  ),
  scenario(
    'tool-edit',
    'the build executor changes; every build task runs through the tool edge',
    edit(FIXTURE_WORKSPACE, 'tools/tooling/src/index.ts', 'export const build = (): void => {\n  return undefined\n}\n'),
    ['M\ttools/tooling/src/index.ts']
  ),
  scenario(
    'root-input-edit',
    'a file the root project names through a {workspaceRoot}/ input changes',
    edit(FIXTURE_WORKSPACE, 'docs/guide.md', '# Guide\n\nMore.\n'),
    ['M\tdocs/guide.md']
  ),
  scenario(
    'global-config-edit',
    'nx.json changes; everything is affected with the file named as the reason',
    edit(FIXTURE_WORKSPACE, 'nx.json', `${FIXTURE_WORKSPACE['nx.json'] as string}\n`),
    ['M\tnx.json']
  ),
  scenario(
    'renamed-module',
    'an alpha module moves; its importer follows the new path and the old path has no dependents left',
    edit(
      edit(
        without(FIXTURE_WORKSPACE, 'libs/alpha/src/extra/extra-impl.ts'),
        'libs/alpha/src/extra/index.ts',
        "export { extra } from './extra-work'\n"
      ),
      'libs/alpha/src/extra/extra-work.ts',
      FIXTURE_WORKSPACE['libs/alpha/src/extra/extra-impl.ts'] as string
    ),
    ['M\tlibs/alpha/src/extra/index.ts', 'R100\tlibs/alpha/src/extra/extra-impl.ts\tlibs/alpha/src/extra/extra-work.ts']
  ),
  scenario(
    'deleted-project-file',
    'a project configuration is deleted; the project and its dependents fall back to project level',
    without(FIXTURE_WORKSPACE, 'libs/beta/project.json'),
    ['D\tlibs/beta/project.json']
  ),
])

/**
 * The fixture of a name.
 *
 * @param name - What the scenario is called
 * @returns The scenario carrying that name
 */
export function fixtureNamed(name: string): WorkspaceFixture {
  const fixture = FIXTURES.find((candidate) => candidate.name === name)
  if (fixture === undefined) throw createError(`no fixture named ${name}`)
  return fixture
}

/**
 * Runs git in the planted repository.
 *
 * @param root - The repository root
 * @param args - The arguments after `git`
 * @returns The trimmed standard output
 */
function git(root: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...IDENTITY },
  }).trim()
}

/**
 * Commits everything in the repository.
 *
 * @param root - The repository root
 * @param message - What the commit says
 * @returns The commit's sha
 */
function commitAll(root: string, message: string): string {
  git(root, ['add', '-A'])
  git(root, ['commit', '-q', '-m', message])
  return git(root, ['rev-parse', 'HEAD'])
}

/**
 * Plants a fixture as a repository: the base tree committed, then the head tree committed on top.
 *
 * @param fixture - The scenario
 * @returns The repository and its two commits
 */
export function plantFixture(fixture: WorkspaceFixture): PlantedFixture {
  const directory: TempDir = createTempDir({ prefix: `graph-${fixture.name}-`, tree: fixture.base })
  git(directory.path, ['init', '-q', '--initial-branch=main'])
  const base = commitAll(directory.path, 'base')
  for (const path of keys(fixture.base)) {
    if (!(path in fixture.head)) rmSync(directory.resolve(...path.split(posix.sep)))
  }
  for (const [path, content] of entries(fixture.head)) {
    if (fixture.base[path] !== content) directory.write(path, content)
  }
  const head = commitAll(directory.path, fixture.name)
  return { root: directory.path, base, head, remove: () => directory.remove() }
}
