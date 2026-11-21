/**
 * Git hook E2E tests for `@hyperfrontend/workspace`.
 *
 * The packed tarball is installed into a consumer that is a repository of its own, with a bare repository beside it as
 * its remote. The hooks are installed with `hf generate hooks`, and from then on every test goes through Git: a real
 * `git commit` and a real `git push` start the stubs, which on Windows means Git's own `sh`, and the stubs start the
 * installed command line.
 */

import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The hooks of the consumer: a fixer and a message check for a commit, a version check for a push, and the bump `hf push` makes first. */
const HOOKS = [
  "import { defineHooks } from '@hyperfrontend/workspace/git-hooks'",
  '',
  'export default defineHooks({',
  "  'pre-commit': [{ name: 'fix', run: ['node', 'tools/fix.mjs'], stageFixed: true }],",
  "  'commit-msg': [{ name: 'message', run: ['node', 'tools/message.mjs'], passArgs: true, failText: 'Start the message with a type.' }],",
  "  'pre-push': [",
  "    { name: 'version-check', run: ['hf', 'run', 'core:version-check'], failText: 'Push with npx hf push.' },",
  "    { name: 'slow', run: ['node', '-e', 'process.exit(0)'] },",
  '  ],',
  "  push: [{ name: 'version', run: ['hf', 'run', 'core:version'] }],",
  '})',
  '',
].join('\n')

/** The fixer: it strips the trailing spaces of every note, the way a formatter rewrites what it is given. */
const FIX = [
  "import { readdirSync, readFileSync, writeFileSync } from 'node:fs'",
  '',
  "for (const name of readdirSync('notes')) {",
  '  const file = `notes/${name}`',
  "  writeFileSync(file, readFileSync(file, 'utf8').replace(/[ \\t]+$/gm, ''))",
  '}',
  '',
].join('\n')

/** The message check: it reads the file Git names and refuses a message that does not start with a type. */
const MESSAGE = [
  "import { readFileSync } from 'node:fs'",
  '',
  "if (!/^[a-z]+(\\([a-z-]+\\))?: /.test(readFileSync(process.argv[2], 'utf8'))) process.exit(1)",
  '',
].join('\n')

/** The workspace written into the consumer: one library with the release targets of the package. */
const WORKSPACE = {
  '.gitignore': 'node_modules\n.hf\n',
  'hf.json': {},
  'hooks.config.ts': HOOKS,
  'tools/fix.mjs': FIX,
  'tools/message.mjs': MESSAGE,
  'notes/staged.txt': 'staged, with a trailing space \n',
  'notes/partial.txt': 'partly staged, with a trailing space \n',
  'packages/core/project.json': {
    name: 'core',
    projectType: 'library',
    targets: {
      version: { executor: '@hyperfrontend/workspace:version' },
      'version-check': { executor: '@hyperfrontend/workspace:version-check' },
    },
  },
  'packages/core/package.json': { name: '@consumer/core', version: '0.0.0', license: 'MIT' },
  'packages/core/src/index.ts': 'export const double = (value: number): number => value * 2\n',
}

/** What a run of git answered. */
type GitRun = ConsumerRun

const consumer = usePackedConsumer({ tarball: process.env['HF_E2E_TARBALL'] })
const remote = createTempDir()

/**
 * Runs git in the consumer with a fixed identity, hooks included.
 *
 * @param args - The git arguments
 * @param env - Variables set for the run
 * @returns The exit code and what git and its hooks printed
 */
function git(args: readonly string[], env: NodeJS.ProcessEnv = {}): GitRun {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=Consumer', '-c', 'user.email=consumer@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd: consumer.path, encoding: 'utf8', env: { ...process.env, ...env } }
  )
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

/**
 * Runs the installed executable in the consumer, as a clone would: outside CI.
 *
 * @param args - The arguments after `hf`
 * @returns What the run reported
 */
function hf(args: readonly string[]): ConsumerRun {
  return consumer.node([join(consumer.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs'), ...args], { env: { CI: '' } })
}

/**
 * The subjects of the commits a repository holds on main, newest first.
 *
 * @param directory - The repository
 * @returns The subjects, or none when it has no such branch
 */
function subjects(directory: string): string[] {
  const log = spawnSync('git', ['log', '--format=%s', 'main'], { cwd: directory, encoding: 'utf8' })
  return log.status === 0 ? log.stdout.split(/\r?\n/).filter((line) => line !== '') : []
}

before(() => {
  consumer.writeTree(WORKSPACE)
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', remote.path])
  git(['init', '-q', '-b', 'main'])
  // why: the version flow commits as the repository's own identity, which a runner need not be able to work out
  git(['config', 'user.name', 'Consumer'])
  git(['config', 'user.email', 'consumer@example.com'])
  git(['config', 'commit.gpgsign', 'false'])
  git(['remote', 'add', 'origin', remote.path])
})

after(() => {
  remote.remove()
})

describe('hf generate hooks', () => {
  let run: ConsumerRun

  before(() => {
    run = hf(['generate', 'hooks'])
  })

  it('writes a stub per configured hook, each starting the installed command line', () => {
    expect({
      status: run.status,
      stubs: ['pre-commit', 'commit-msg', 'pre-push'].map((hook) =>
        readFileSync(join(consumer.path, '.git', 'hooks', hook), 'utf8')
          .split(/\r?\n/)
          .at(2)
      ),
    }).toEqual({
      status: 0,
      stubs: ['pre-commit', 'commit-msg', 'pre-push'].map(
        (hook) => `exec node "node_modules/@hyperfrontend/workspace/bin/hf.mjs" hooks run ${hook} "$@"`
      ),
    })
  })

  it('keeps the local file of a clone out of the repository', () => {
    expect(readFileSync(join(consumer.path, '.gitignore'), 'utf8')).toBe('node_modules\n.hf\nhooks.local.config.ts\n')
  })

  it('writes nothing under CI', () => {
    const quiet = consumer.node(
      [join(consumer.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs'), 'generate', 'hooks'],
      {
        env: { CI: 'true' },
      }
    )
    expect({ status: quiet.status, stdout: quiet.stdout }).toEqual({ status: 0, stdout: '' })
  })
})

describe('git commit through the installed hooks', () => {
  let refused: GitRun
  let committed: GitRun

  before(() => {
    git(['add', '-A'])
    // why: a file edited after it was staged holds content the committer has not chosen to commit
    consumer.write('notes/partial.txt', 'partly staged, with a trailing space \nand a line added after staging \n')
    refused = git(['commit', '-m', 'Add the core library'])
    committed = git(['commit', '-m', 'feat(core): add the core library'])
  })

  it('refuses a commit whose message the commit-msg step fails, with the text of that step', () => {
    expect({ status: refused.status, said: refused.stderr.includes('Start the message with a type.') }).toEqual({ status: 1, said: true })
  })

  it('commits once every step passes', () => {
    expect({ status: committed.status, subjects: subjects(consumer.path) }).toEqual({
      status: 0,
      subjects: ['feat(core): add the core library'],
    })
  })

  it('commits what the fixer changed in a file that was fully staged', () => {
    expect(git(['show', 'HEAD:notes/staged.txt']).stdout).toBe('staged, with a trailing space\n')
  })

  it('commits a partly staged file as it was staged', () => {
    expect(git(['show', 'HEAD:notes/partial.txt']).stdout).toBe('partly staged, with a trailing space \n')
  })

  it('ends the hook on a list of its steps', () => {
    expect(committed.stderr).toMatch(/pre-commit\r?\n {2}✓ fix {2}\d/)
  })
})

describe('git push through the installed hooks', () => {
  let plain: GitRun
  let skipped: GitRun
  let pushed: ConsumerRun

  before(() => {
    git(['checkout', '-q', '--', 'notes/partial.txt'])
    plain = git(['push', '--set-upstream', 'origin', 'main'])
    consumer.write('hooks.local.config.ts', "export default { skip: ['slow'] }\n")
    skipped = git(['push', '--set-upstream', 'origin', 'main'], { HF_HOOKS_SKIP: 'version-check' })
    spawnSync('git', ['update-ref', '-d', 'refs/heads/main'], { cwd: remote.path })
    pushed = hf(['push', '--set-upstream', 'origin', 'main'])
  })

  it('refuses a plain push that lacks a due bump, with the text of the version check', () => {
    expect({ status: plain.status, said: plain.stderr.includes('Push with npx hf push.') }).toEqual({ status: 1, said: true })
  })

  it('lists the steps a clone and an invocation skipped, each with what skipped it', () => {
    expect(skipped.stderr.split(/\r?\n/)).toEqual(
      expect.arrayContaining(['  - version-check  skipped by HF_HOOKS_SKIP', '  - slow           skipped by hooks.local.config.ts'])
    )
  })

  it('bumps, commits and pushes once with hf push, leaving the remote with the change and the version commit', () => {
    expect({ status: pushed.status, remote: subjects(remote.path), local: subjects(consumer.path) }).toEqual({
      status: 0,
      remote: ['chore(core): release version 0.1.0', 'feat(core): add the core library'],
      local: ['chore(core): release version 0.1.0', 'feat(core): add the core library'],
    })
  })

  it('leaves the local file of the clone ignored', () => {
    expect(git(['status', '--porcelain', '--ignored', '--', 'hooks.local.config.ts']).stdout).toBe('!! hooks.local.config.ts\n')
  })
})
