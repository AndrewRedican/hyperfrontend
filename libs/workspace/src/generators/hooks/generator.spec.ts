import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { commitChanges, createFsTree, createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio } from '@hyperfrontend/testing/process'
import { GIT_HOOKS } from '../../git-hooks/config'
import { stubOrigin } from '../../git-hooks/stubs'
import { DEFAULT_HOOKS, hooksGenerator, stubDirectory, writeHooksSetup, writeStubs } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

/** A stub as Lefthook writes it. */
const LEFTHOOK = '#!/bin/sh\ncall_lefthook run "pre-commit" "$@"\n'

/** A hook file somebody else wrote. */
const FOREIGN = '#!/bin/sh\ngit lfs pre-push "$@"\n'

/** A configuration that gives one hook steps and another none. */
const CONFIG = "export default { 'commit-msg': [{ name: 'message', run: ['cl'], passArgs: true }], 'pre-push': [] }\n"

describe('writeHooksSetup', () => {
  it('writes a first configuration whose hooks are the ones the generator installs', () => {
    const tree = createMemoryTree()
    writeHooksSetup(tree)
    const config = tree.read('hooks.config.ts', 'utf-8') as string
    expect(GIT_HOOKS.filter((hook) => config.includes(`'${hook}': [`))).toEqual(DEFAULT_HOOKS)
  })

  it('keeps the configuration a workspace already has', () => {
    const tree = createMemoryTree({ 'hooks.config.ts': CONFIG })
    writeHooksSetup(tree)
    expect(tree.read('hooks.config.ts', 'utf-8')).toBe(CONFIG)
  })

  it.each([
    ['a repository without a .gitignore', {}, 'hooks.local.config.ts\n'],
    ['a .gitignore that ends on a line break', { '.gitignore': 'dist\n' }, 'dist\nhooks.local.config.ts\n'],
    ['a .gitignore that ends without one', { '.gitignore': 'dist' }, 'dist\nhooks.local.config.ts\n'],
    ['a .gitignore that lists it already', { '.gitignore': 'hooks.local.config.ts\r\ndist\r\n' }, 'hooks.local.config.ts\r\ndist\r\n'],
  ])('keeps the local file of a clone out of %s', (_, files, ignored) => {
    const tree = createMemoryTree(files)
    writeHooksSetup(tree)
    expect(tree.read('.gitignore', 'utf-8')).toBe(ignored)
  })
})

describe('writeStubs', () => {
  it('writes an executable stub per hook into a directory that is not there yet', () => {
    const tree = createMemoryTree({}, { root: REPO_ROOT })
    writeStubs(tree, { directory: '.git/hooks', hooks: ['pre-commit', 'pre-push'], force: false })
    expect(tree.listChanges().map((change) => [change.path, (change as { mode?: number }).mode])).toEqual([
      ['.git/hooks/pre-commit', 0o755],
      ['.git/hooks/pre-push', 0o755],
    ])
  })

  it('starts the command line of this package from the stub', () => {
    const tree = createMemoryTree({}, { root: REPO_ROOT })
    writeStubs(tree, { directory: '.git/hooks', hooks: ['pre-commit'], force: false })
    expect(tree.read('.git/hooks/pre-commit', 'utf-8')).toContain('exec node "libs/workspace/bin/hf.mjs" hooks run pre-commit "$@"')
  })

  it('takes the place of a Lefthook stub and removes the ones of hooks that are not configured', () => {
    const tree = createMemoryTree({ '.git/hooks/pre-commit': LEFTHOOK, '.git/hooks/post-commit': LEFTHOOK }, { root: REPO_ROOT })
    writeStubs(tree, { directory: '.git/hooks', hooks: ['pre-commit'], force: false })
    expect(tree.listChanges().map((change) => [change.type, change.path])).toEqual([
      ['DELETE', '.git/hooks/post-commit'],
      ['UPDATE', '.git/hooks/pre-commit'],
    ])
  })

  it('refuses to replace a hook file somebody else wrote', () => {
    const tree = createMemoryTree({ '.git/hooks/pre-push': FOREIGN }, { root: REPO_ROOT })
    expect(() => writeStubs(tree, { directory: '.git/hooks', hooks: ['pre-commit', 'pre-push'], force: false })).toThrow(
      '.git/hooks/pre-push was not written by hf generate hooks: move it aside, or pass --force to replace it'
    )
  })

  it('writes nothing when it refuses', () => {
    const tree = createMemoryTree({ '.git/hooks/pre-push': FOREIGN }, { root: REPO_ROOT })
    try {
      writeStubs(tree, { directory: '.git/hooks', hooks: ['pre-commit', 'pre-push'], force: false })
    } catch {
      // why: the refusal is asserted by the case before; this one reads what it left behind
    }
    expect(tree.listChanges()).toEqual([])
  })

  it('replaces a hook file somebody else wrote when forced', () => {
    const tree = createMemoryTree({ '.git/hooks/pre-push': FOREIGN }, { root: REPO_ROOT })
    writeStubs(tree, { directory: '.git/hooks', hooks: ['pre-push'], force: true })
    expect(stubOrigin(tree.read('.git/hooks/pre-push', 'utf-8') as string)).toBe('own')
  })
})

describe('in a clone', () => {
  const dir = useTempDir()

  /**
   * Makes the directory a repository.
   *
   * @param files - The files it holds
   */
  function repository(files: Readonly<Record<string, string>> = {}): void {
    execFileSync('git', ['init', '-q'], { cwd: dir.path })
    for (const [path, content] of entries(files)) dir.write(path, content)
  }

  /**
   * The hook files of the repository that are not the samples Git writes.
   *
   * @returns Their names, sorted
   */
  function hookFiles(): string[] {
    return createFsTree(dir.path)
      .children('.git/hooks')
      .filter((name) => !name.endsWith('.sample'))
      .sort()
  }

  describe('stubDirectory', () => {
    it('is the hooks directory of the repository', () => {
      repository()
      expect(stubDirectory(createFsTree(dir.path), {})).toBe('.git/hooks')
    })

    it('is none, and says why, below the root of the repository', () => {
      repository({ 'tools/keep': '' })
      const stdio = captureStdio()
      const directory = stubDirectory(createFsTree(join(dir.path, 'tools')), {})
      const said = stdio.stderr()
      stdio.restore()
      expect([directory, said]).toEqual([
        null,
        'hf generate hooks: no hook installed: the workspace is not at the root of its repository\n',
      ])
    })
  })

  describe('hooksGenerator', () => {
    it('writes nothing under CI', async () => {
      repository()
      const tree = createFsTree(dir.path)
      await hooksGenerator(tree, {}, { CI: 'true' })
      expect(tree.listChanges()).toEqual([])
    })

    it('writes nothing outside a repository', async () => {
      const tree = createFsTree(dir.path)
      await hooksGenerator(tree, {}, {})
      expect(tree.listChanges()).toEqual([])
    })

    it('gives a workspace without a configuration its first one, the ignore line and the stubs', async () => {
      repository()
      const tree = createFsTree(dir.path)
      await hooksGenerator(tree, { skipFormat: true }, {})
      expect(tree.listChanges().map((change) => change.path)).toEqual([
        '.git/hooks/pre-commit',
        '.git/hooks/pre-push',
        '.gitignore',
        'hooks.config.ts',
      ])
    })

    it('installs the hooks that have steps and removes its stub of one that has none', async () => {
      repository({ 'hooks.config.ts': CONFIG })
      const first = createFsTree(dir.path)
      writeStubs(first, { directory: '.git/hooks', hooks: ['pre-push'], force: false })
      commitChanges(first)
      const tree = createFsTree(dir.path)
      await hooksGenerator(tree, {}, {})
      commitChanges(tree)
      expect(hookFiles()).toEqual(['commit-msg'])
    })

    it('leaves the stubs executable, and a directory among the hooks alone', async () => {
      repository({ 'hooks.config.ts': CONFIG })
      mkdirSync(join(dir.path, '.git', 'hooks', 'kept'))
      const tree = createFsTree(dir.path)
      await hooksGenerator(tree, {}, {})
      commitChanges(tree)
      // why: Windows keeps no executable bit, and Git for Windows runs a hook without one
      expect([
        hookFiles(),
        process.platform === 'win32' || (statSync(join(dir.path, '.git', 'hooks', 'commit-msg')).mode & 0o111) !== 0,
      ]).toEqual([['commit-msg', 'kept'], true])
    })

    it('replaces a foreign hook file only when forced', async () => {
      repository({ 'hooks.config.ts': CONFIG, '.git/hooks/commit-msg': FOREIGN })
      const tree = createFsTree(dir.path)
      await hooksGenerator(tree, { force: true }, {})
      expect(stubOrigin(tree.read('.git/hooks/commit-msg', 'utf-8') as string)).toBe('own')
    })
  })
})

describe('hooksGenerator in this repository', () => {
  it('formats the first configuration it writes unless asked not to', async () => {
    const tree = createMemoryTree({}, { root: REPO_ROOT })
    await hooksGenerator(tree, {}, {})
    expect(tree.read('hooks.config.ts', 'utf-8')).toContain("import { defineHooks } from '@hyperfrontend/workspace/git-hooks'")
  })
})
