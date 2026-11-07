import type { GraphOutput } from './graph'
import { execFileSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { runGraph } from './graph'

/** What a run wrote and answered. */
interface Run {
  /** The exit code. */
  readonly code: number
  /** The lines of the result. */
  readonly said: readonly string[]
  /** The lines about what the command did on the way. */
  readonly noted: readonly string[]
}

const workspace = useTempDir({
  prefix: 'graph-command-',
  tree: {
    '.gitignore': '.hf\n',
    'package.json': { name: '@fixture/workspace', private: true },
    'package-lock.json': { name: '@fixture/workspace', lockfileVersion: 3, packages: { '': { name: '@fixture/workspace' } } },
    'hf.json': {},
    'tsconfig.base.json': { compilerOptions: { paths: { '@fixture/core': ['libs/core/src/index.ts'] } } },
    'libs/core/project.json': { name: 'lib-core', projectType: 'library', tags: ['scope:core'], targets: { build: {} } },
    'libs/core/src/index.ts': 'export const core = 1\n',
    'apps/shop/project.json': { name: 'app-shop', projectType: 'application', targets: { build: {} } },
    'apps/shop/src/main.ts': "import { core } from '@fixture/core'\nexport const shop = core\n",
  },
})

/**
 * Runs git in the workspace.
 *
 * @param args - The arguments after `git`
 */
function git(args: readonly string[]): void {
  execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], { cwd: workspace.path, stdio: 'ignore' })
}

/**
 * Runs the command, keeping what it wrote.
 *
 * @param argv - The arguments after `graph`
 * @returns The exit code and the lines of both streams
 */
function run(argv: readonly string[]): Run {
  const said: string[] = []
  const noted: string[] = []
  const output: GraphOutput = { say: (line) => said.push(line), note: (line) => noted.push(line) }
  return { code: runGraph(argv, workspace.path, output), said, noted }
}

beforeEach(() => {
  git(['init', '-q'])
  git(['add', '-A'])
  git(['commit', '-q', '-m', 'base'])
})

describe('runGraph over a workspace', () => {
  it('lists the projects it finds', () => {
    expect(run(['projects']).said).toEqual([
      '@fixture/workspace\tapp\t.\t',
      'app-shop\tapp\tapps/shop\t',
      'lib-core\tlib\tlibs/core\tscope:core',
    ])
  })

  it('explains what a project depends on and what depends on it, from its imports', () => {
    expect(run(['explain', 'lib-core']).said).toEqual([
      'lib-core (lib, libs/core)',
      'depends on',
      '  → tool:@hyperfrontend/workspace:run-commands',
      '      tool build-config (1 file): libs/core/project.json',
      'depended on by',
      '  ← app-shop',
      '      value production (1 file): apps/shop/src/main.ts',
    ])
  })

  it('reports a state with no graph until a build persists it', () => {
    expect(run(['status']).said[0]).toBe('no graph state')
  })

  it('reports the persisted state after a build', () => {
    run(['build'])
    expect(run(['status']).said[0]).toEqual(expect.stringContaining('graph state present ('))
  })

  it('writes nothing when a second build finds nothing changed', () => {
    run(['build'])
    expect(run(['build']).said).toEqual([expect.stringContaining('nothing written')])
  })

  it('rewrites nothing either under --force, the bytes being the same', () => {
    run(['build'])
    expect(run(['build', '--force']).said).toEqual([expect.stringContaining('nothing written')])
  })

  it('verifies the state a build wrote', () => {
    run(['build'])
    expect(run(['verify'])).toEqual({ code: 0, said: ['graph state verified: a cold build agrees byte for byte'], noted: [] })
  })

  it('finds a difference in a state a change left behind', () => {
    run(['build'])
    workspace.write('libs/core/src/index.ts', "export const core = 2\nexport { helper } from './helper'\n")
    workspace.write('libs/core/src/helper.ts', 'export const helper = 3\n')
    expect(run(['verify']).code).toBe(1)
  })

  it('selects the task of a changed project and of the project importing it', () => {
    workspace.write('libs/core/src/index.ts', 'export const core = 2\n')
    expect(run(['affected', '--target', 'build', '--base', 'HEAD']).said).toEqual(['app-shop:build', 'lib-core:build'])
  })

  it('selects nothing for a working tree that matches the base', () => {
    expect(run(['affected', '--target', 'build', '--base', 'HEAD']).said).toEqual([])
  })

  it('says a task is selected, with why', () => {
    workspace.write('libs/core/src/index.ts', 'export const core = 2\n')
    expect(run(['explain', 'lib-core:build', '--base', 'HEAD']).said[0]).toBe('lib-core:build is selected')
  })

  it('says a task a clean tree leaves alone is skipped', () => {
    expect(run(['explain', 'lib-core:build', '--base', 'HEAD']).said[0]).toBe('lib-core:build is skipped')
  })

  it('says a target no project has holds no such task', () => {
    expect(run(['explain', 'lib-core:absent', '--base', 'HEAD']).said).toEqual(['lib-core:absent is not a task of absent'])
  })

  it('prints a selection as JSON naming what it compared', () => {
    workspace.write('libs/core/src/index.ts', 'export const core = 2\n')
    const set = parse(run(['affected', '--target', 'build', '--base', 'HEAD', '--json']).said.join('\n'))
    expect({ target: set.target, changed: set.changes.changes }).toEqual({
      target: 'build',
      changed: [{ status: 'modified', path: 'libs/core/src/index.ts', previousPath: null }],
    })
  })
})
