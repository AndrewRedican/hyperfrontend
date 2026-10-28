import type { FileTree } from '@hyperfrontend/testing/fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { after as afterAll } from 'node:test'
import { pathToFileURL } from 'node:url'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { selectAffected } from '../graph/affected/select'
import { workspaceGraph } from '../graph/build'
import { changeSet } from '../graph/changes'

/** The workspace these sources belong to. */
const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

/** The hook the command lines load workspace sources through, as `--import` takes it. */
const ALIASES = pathToFileURL(resolve(WORKSPACE_ROOT, 'tools', 'lint', 'src', 'runtime', 'aliases.ts')).href

/** The fixture workspace at its base: a library and a second one importing it. */
const BASE: FileTree = {
  'nx.json': { namedInputs: { default: ['{projectRoot}/**/*'] }, targetDefaults: { build: { inputs: ['default', '^default'] } } },
  'package.json': { name: '@fixture/workspace', private: true },
  'tsconfig.base.json': { compilerOptions: { paths: { '@fixture/a': ['libs/a/src/index.ts'], '@fixture/b': ['libs/b/src/index.ts'] } } },
  '.gitignore': '.hf\n',
  'libs/a/project.json': { name: 'lib-a', projectType: 'library', sourceRoot: 'libs/a/src', targets: { build: {} } },
  'libs/a/package.json': { name: '@fixture/a', version: '0.0.0' },
  'libs/a/src/index.ts': 'export const a = 1\n',
  'libs/b/project.json': { name: 'lib-b', projectType: 'library', sourceRoot: 'libs/b/src', targets: { build: {} } },
  'libs/b/package.json': { name: '@fixture/b', version: '0.0.0' },
  'libs/b/src/index.ts': "import { a } from '@fixture/a'\nexport const b = a + 1\n",
}

const fixture = createTempDir({ tree: BASE })
afterAll(() => fixture.remove())

/**
 * Runs git in the fixture, as a fixed identity.
 *
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], {
    cwd: fixture.path,
    encoding: 'utf8',
  }).trim()
}

git('init', '-q')
git('add', '-A')
git('commit', '-q', '-m', 'base')
fixture.write('libs/a/src/index.ts', 'export const a = 2\n')
git('add', '-A')
git('commit', '-q', '-m', 'head')
const base = git('rev-parse', 'HEAD~1')
const head = git('rev-parse', 'HEAD')

/** The selection of the change, as `--json` prints it. */
const SELECTION = `${stringify(
  selectAffected({ graph: workspaceGraph(fixture.path), changes: changeSet(fixture.path, base, head), targets: ['build'] }).get('build'),
  null,
  2
)}\n`

/**
 * What a command line prints on standard output for the build tasks the change selects.
 *
 * @param bin - The command line's file under `tools/workspace/bin`
 * @param format - The output flag
 * @returns Standard output, whole
 */
function affectedOutput(bin: string, format: string): string {
  return execFileSync(
    process.execPath,
    [
      '--import',
      ALIASES,
      resolve(WORKSPACE_ROOT, 'tools', 'workspace', 'bin', bin),
      'affected',
      '--target',
      'build',
      '--base',
      base,
      '--head',
      head,
      format,
    ],
    { cwd: fixture.path, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
}

describe('pipeline affected', () => {
  it('prints only the selected projects under --projects', () => {
    expect(affectedOutput('pipeline.ts', '--projects')).toBe('lib-a\nlib-b\n')
  })

  it('prints only the selection under --json', () => {
    expect(affectedOutput('pipeline.ts', '--json')).toBe(SELECTION)
  })
})

describe('graph affected', () => {
  it('prints only the selection under --json', () => {
    expect(affectedOutput('graph.ts', '--json')).toBe(SELECTION)
  })
})
