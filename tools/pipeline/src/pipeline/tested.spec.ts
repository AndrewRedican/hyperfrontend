import { execFileSync } from 'node:child_process'
import { utimesSync } from 'node:fs'
import { after as afterAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { changeSet } from '@hyperfrontend/workspace/graph'
import { changesBetween, reasonOf, runIdentity, testedOf, testedOrNull, testedTree, treeCommit } from './tested'

const fixture = createTempDir({
  prefix: 'pipeline-tested-',
  tree: {
    '.gitignore': 'ignored/\n',
    '.hfignore': 'CHANGELOG.md\n',
    'libs/a/src/index.ts': 'export const a = 1\n',
    'libs/a/src/old.ts': 'export const old = "a file long enough for git to recognise it under another name"\n',
    'CHANGELOG.md': '# 1\n',
  },
})
const fresh = createTempDir({ prefix: 'pipeline-tested-fresh-', tree: { 'only.ts': 'export {}\n' } })
afterAll(() => {
  fixture.remove()
  fresh.remove()
})

/**
 * Runs git in a repository, as a fixed identity.
 *
 * @param cwd - The repository
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function gitIn(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], { cwd, encoding: 'utf8' }).trim()
}

/**
 * Runs git in the fixture.
 *
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(...args: string[]): string {
  return gitIn(fixture.path, ...args)
}

git('init', '-q', '-b', 'main')
git('add', '-A')
git('commit', '-q', '-m', 'base')
const base = git('rev-parse', 'HEAD')
const cleanTree = testedTree(fixture.path)
fixture.write('libs/a/src/index.ts', 'export const a = 2\n')
fixture.write('libs/a/src/added.ts', 'export const added = 1\n')
fixture.write('ignored/build.js', 'ignored\n')
const dirtyTree = testedTree(fixture.path)
const stagedWhileDirty = git('diff', '--cached', '--name-only')
git('mv', 'libs/a/src/old.ts', 'libs/a/src/new.ts')
fixture.write('CHANGELOG.md', '# 2\n')
git('add', '-A')
git('commit', '-q', '-m', 'head')
const head = git('rev-parse', 'HEAD')
git('checkout', '-q', '-b', 'topic', base)
fixture.write('libs/a/src/topic.ts', 'export const topic = 1\n')
git('add', '-A')
git('commit', '-q', '-m', 'topic')
const topic = git('rev-parse', 'HEAD')
git('checkout', '-q', 'main')
git('merge', '-q', '--no-ff', '-m', 'merge', 'topic')
const merge = git('rev-parse', 'HEAD')
gitIn(fresh.path, 'init', '-q')

describe('testedTree', () => {
  it('answers the tree of the head commit on a clean checkout', () => {
    expect(cleanTree).toBe(git('rev-parse', `${base}^{tree}`))
  })

  it('answers the tree a commit of every modified and untracked file would have, ignored files left out', () => {
    expect(git('ls-tree', '-r', '--name-only', dirtyTree).split(/\r?\n/)).toEqual([
      '.gitignore',
      '.hfignore',
      'CHANGELOG.md',
      'libs/a/src/added.ts',
      'libs/a/src/index.ts',
      'libs/a/src/old.ts',
    ])
  })

  it('reads the content of the working tree, not of the index', () => {
    expect(git('show', `${dirtyTree}:libs/a/src/index.ts`)).toBe('export const a = 2')
  })

  it('leaves the real index alone', () => {
    expect(stagedWhileDirty).toBe('')
  })

  it('answers the tree of a repository nothing was ever added to', () => {
    expect(gitIn(fresh.path, 'ls-tree', '-r', '--name-only', testedTree(fresh.path))).toBe('only.ts')
  })
})

describe('testedTree of a file rewritten in the second the index was written', () => {
  const racy = createTempDir({ prefix: 'pipeline-tested-racy-', tree: { 'a.ts': 'export const a = 1\n' } })
  afterAll(() => racy.remove())
  /** A second long past, which the file, its index entry and the index file all carry. */
  const THEN = 1500000000
  gitIn(racy.path, 'init', '-q')
  // why: the time a file's status last changed cannot be set, so it is left out of what git compares
  gitIn(racy.path, 'config', 'core.trustctime', 'false')
  utimesSync(racy.resolve('a.ts'), THEN, THEN)
  gitIn(racy.path, 'add', '-A')
  utimesSync(racy.resolve('.git', 'index'), THEN, THEN)
  racy.write('a.ts', 'export const a = 2\n')
  utimesSync(racy.resolve('a.ts'), THEN, THEN)

  it('reads the content of the file, although its size and times are the ones the index recorded', () => {
    expect(gitIn(racy.path, 'show', `${testedTree(racy.path)}:a.ts`)).toBe('export const a = 2')
  })
})

describe('testedOf', () => {
  it('names no commit when the run is not of a pull request', () => {
    expect(testedOf(fixture.path, false)).toEqual({ tree: git('rev-parse', 'HEAD^{tree}'), head: null, base: null, merge: null })
  })

  it('names the head, the base and the merge of a pull request checked out as their merge', () => {
    expect(testedOf(fixture.path, true)).toEqual({ tree: git('rev-parse', 'HEAD^{tree}'), head: topic, base: head, merge })
  })

  it('names no commit when the head commit of a pull request checkout is not a merge', () => {
    git('checkout', '-q', '--detach', topic)
    const tested = testedOf(fixture.path, true)
    git('checkout', '-q', 'main')
    expect(tested).toEqual({ tree: git('rev-parse', `${topic}^{tree}`), head: null, base: null, merge: null })
  })
})

describe('testedOrNull', () => {
  it('answers what the plan is made on, saying nothing, where git can write the tree', () => {
    const lines: string[] = []
    expect({ tested: testedOrNull(fixture.path, false, (line) => lines.push(line)), lines }).toEqual({
      tested: testedOf(fixture.path, false),
      lines: [],
    })
  })

  it('answers null and says why where git cannot write the tree', () => {
    const lines: string[] = []
    const outside = createTempDir({ prefix: 'pipeline-tested-outside-' })
    const tested = testedOrNull(outside.resolve('absent'), false, (line) => lines.push(line))
    outside.remove()
    expect({ tested, lines }).toEqual({
      tested: null,
      lines: [
        expect.stringMatching(/^nothing is inherited by this run or from it: the tree of the working tree could not be written \(.+\)$/),
      ],
    })
  })
})

describe('reasonOf', () => {
  /**
   * An error as a failed command throws it.
   *
   * @param stderr - What the command left on standard error, as the error carries it
   * @returns The error, naming the command on its first line
   */
  function failed(stderr: unknown): Error {
    return Object.assign(new Error('Command failed: git add -A\nerror: open("secret"): Permission denied'), { stderr })
  }

  it('answers the first line the command wrote to standard error that says error or fatal, passing over the warnings before it', () => {
    const stderr = [
      '',
      "warning: in the working copy of 'notes.md', CRLF will be replaced by LF the next time Git touches it",
      'hint: use git config core.safecrlf to silence this',
      'error: open("secret"): Permission denied',
      'fatal: adding files failed',
      '',
    ].join('\n')
    expect(reasonOf(failed(stderr))).toBe('error: open("secret"): Permission denied')
  })

  it('answers the first line the command wrote when none says error or fatal', () => {
    expect(reasonOf(failed('Schwerwiegend: kein Git-Repository\nmehr dazu\n'))).toBe('Schwerwiegend: kein Git-Repository')
  })

  it('answers the first line of the text of what was thrown when the command left nothing to read', () => {
    expect(
      [failed('  \n'), failed(null), new Error('no such directory\nat somewhere'), 'thrown as text\nsecond line'].map(reasonOf)
    ).toEqual(['Error: Command failed: git add -A', 'Error: Command failed: git add -A', 'Error: no such directory', 'thrown as text'])
  })
})

describe('treeCommit', () => {
  it('answers a parentless commit of the tree', () => {
    expect(git('rev-list', '--parents', '-n', '1', '--format=%T', treeCommit(fixture.path, cleanTree)).split(/\r?\n/)).toEqual([
      `commit ${treeCommit(fixture.path, cleanTree)}`,
      cleanTree,
    ])
  })

  it('answers the same commit whatever commit encoding is configured', () => {
    const first = treeCommit(fixture.path, cleanTree)
    git('config', 'i18n.commitEncoding', 'ISO-8859-1')
    const second = treeCommit(fixture.path, cleanTree)
    git('config', '--unset', 'i18n.commitEncoding')
    expect(second).toBe(first)
  })

  it('answers one commit per tree, whoever asks and whenever', () => {
    const first = treeCommit(fixture.path, dirtyTree)
    jest.stubEnv('GIT_AUTHOR_NAME', 'someone else')
    jest.stubEnv('GIT_COMMITTER_DATE', '2020-02-02T02:02:02Z')
    const second = treeCommit(fixture.path, dirtyTree)
    expect(second).toBe(first)
  })
})

describe('changesBetween', () => {
  it('lists what differs between two trees, a rename as one change, sorted, less what .hfignore leaves out', () => {
    expect(changesBetween(fixture.path, treeCommit(fixture.path, cleanTree), git('rev-parse', `${head}^{tree}`))).toEqual({
      base: treeCommit(fixture.path, cleanTree),
      head: git('rev-parse', `${head}^{tree}`),
      changes: [
        { status: 'added', path: 'libs/a/src/added.ts', previousPath: null },
        { status: 'modified', path: 'libs/a/src/index.ts', previousPath: null },
        { status: 'renamed', path: 'libs/a/src/new.ts', previousPath: 'libs/a/src/old.ts' },
      ],
    })
  })

  it('lists nothing between a tree and itself', () => {
    expect(changesBetween(fixture.path, cleanTree, cleanTree).changes).toEqual([])
  })

  it('lists what the change set of two commits lists, where one is an ancestor of the other', () => {
    expect(changesBetween(fixture.path, base, head).changes).toEqual(changeSet(fixture.path, base, head).changes)
  })
})

describe('changesBetween across what .hfignore leaves out', () => {
  /**
   * The text of a fixture file, long enough for git to recognise the file under another name.
   *
   * @param name - What the file exports
   * @returns One line of TypeScript
   */
  function body(name: string): string {
    return `export const ${name} = 'a file long enough for git to pair it with itself after a move'\n`
  }
  const moves = createTempDir({
    prefix: 'pipeline-tested-moves-',
    tree: {
      '.hfignore': '**/__fixtures__/**\n',
      'src/kept.ts': body('kept'),
      'src/moved.ts': body('moved'),
      'src/__fixtures__/sample.ts': body('sample'),
      'src/__fixtures__/inner.ts': body('inner'),
    },
  })
  afterAll(() => moves.remove())
  gitIn(moves.path, 'init', '-q')
  gitIn(moves.path, 'add', '-A')
  gitIn(moves.path, 'commit', '-q', '-m', 'before')
  const before = gitIn(moves.path, 'rev-parse', 'HEAD')
  gitIn(moves.path, 'mv', 'src/moved.ts', 'src/__fixtures__/moved.ts')
  gitIn(moves.path, 'mv', 'src/__fixtures__/sample.ts', 'src/sample.ts')
  gitIn(moves.path, 'mv', 'src/__fixtures__/inner.ts', 'src/__fixtures__/renamed.ts')
  gitIn(moves.path, 'commit', '-q', '-m', 'after')
  const after = gitIn(moves.path, 'rev-parse', 'HEAD')

  it('pairs each move as a rename, so the cases below are of renames', () => {
    expect(
      gitIn(moves.path, 'diff', '--name-status', '-M', before, after)
        .split(/\r?\n/)
        .map((line) => line.charAt(0))
    ).toEqual(['R', 'R', 'R'])
  })

  it('counts a move into what is left out as the deletion of the old path, a move out of it as an addition, and drops a move within it', () => {
    expect(changesBetween(moves.path, before, after).changes).toEqual([
      { status: 'deleted', path: 'src/moved.ts', previousPath: null },
      { status: 'added', path: 'src/sample.ts', previousPath: null },
    ])
  })
})

describe('runIdentity', () => {
  it('answers null where the environment names no run', () => {
    expect([runIdentity({}, 'abc'), runIdentity({ GITHUB_RUN_ID: '' }, 'abc')]).toEqual([null, null])
  })

  it('answers null without a head commit', () => {
    expect(runIdentity({ GITHUB_RUN_ID: '7' }, undefined)).toBeNull()
  })

  it('names the run, its attempt, the commit and the page', () => {
    expect(runIdentity({ GITHUB_RUN_ID: '7', GITHUB_RUN_ATTEMPT: '2', GITHUB_REPOSITORY: 'o/r' }, 'abc')).toEqual({
      id: 7,
      attempt: 2,
      sha: 'abc',
      url: 'https://github.com/o/r/actions/runs/7',
    })
  })

  it('counts a run that names no attempt as its first, and links nothing without a repository', () => {
    expect(runIdentity({ GITHUB_RUN_ID: '7' }, 'abc')).toEqual({ id: 7, attempt: 1, sha: 'abc', url: null })
  })
})
