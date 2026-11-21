import type { ChildProcess } from 'node:child_process'
import type { Mock } from '@hyperfrontend/testing'
import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { queueMicrotask } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createFakeChildProcess } from '@hyperfrontend/testing/process'
import { runHooksCommand } from './command'

jest.mock('node:child_process', () => ({
  ...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
  spawn: jest.fn(),
}))

const mockSpawn = spawn as unknown as Mock

/** A configuration with a hook of two steps, one of one, and a step before a push. */
const CONFIG = `export default {
  'pre-commit': [{ name: 'format', run: ['node', 'format.mjs'], stageFixed: true }],
  'commit-msg': [{ name: 'message', run: ['node', 'check.mjs'], passArgs: true, env: { STRICT: '1' } }],
  'pre-push': [
    { name: 'audit', run: ['node', 'audit.mjs'] },
    { name: 'pipeline', run: ['node', 'pipeline.mjs'] },
  ],
  push: [{ name: 'version', run: ['node', 'version.mjs'] }],
}
`

/** What a command answered and wrote. */
interface Ran {
  /** The exit code. */
  readonly code: number
  /** What the command wrote to its stream. */
  readonly written: string
}

/** One child a command started. */
interface Started {
  /** The executable. */
  readonly file: string
  /** Its arguments. */
  readonly args: readonly string[]
  /** The options it was spawned with. */
  readonly options: Readonly<Record<string, unknown>>
}

describe('the commands of the hooks', () => {
  const dir = useTempDir({ tree: { 'hooks.config.ts': CONFIG } })

  /**
   * Has every child end as a case says.
   *
   * @param end - Ends a child, given the script it was started for
   */
  function children(end: (child: ReturnType<typeof createFakeChildProcess>, script: string) => void): void {
    mockSpawn.mockImplementation((_: string, args: readonly string[]) => {
      const child = createFakeChildProcess()
      queueMicrotask(() => end(child, args[0] as string))
      return child as unknown as ChildProcess
    })
  }

  /**
   * The children started so far.
   *
   * @returns Each child's executable, arguments and options
   */
  function started(): Started[] {
    return mockSpawn.mock.calls.map(([file, args, options]) => ({ file, args, options }) as Started)
  }

  /**
   * Runs a command of the hooks in the directory.
   *
   * @param command - What runs: the command of the hooks
   * @param argv - Its arguments
   * @returns The exit code and what was written
   */
  async function ran(command: typeof runHooksCommand, argv: readonly string[]): Promise<Ran> {
    let written = ''
    const code = await command(argv, { root: dir.path, sink: { write: (text: string) => (written += text) } })
    return { code, written }
  }

  beforeEach(() => {
    mockSpawn.mockReset()
    children((child) => child.exit(0))
  })

  describe('hooks run', () => {
    it.each([
      ['another subcommand', ['install'], 'the hooks are run with hf hooks run <hook>'],
      ['no hook', ['run'], 'name the hook to run: pre-commit, commit-msg, pre-push, push'],
      ['a hook that is not one', ['run', 'post-merge'], 'name the hook to run: pre-commit, commit-msg, pre-push, push'],
      ['a flag it does not take', ['run', 'pre-push', '--force'], 'hooks run takes --only=<steps> and --skip=<steps>, got --force'],
      ['a flag without its steps', ['run', 'pre-push', '--only'], 'hooks run takes --only=<steps> and --skip=<steps>, got --only'],
    ])('refuses %s', (_, argv, message) => {
      expect(() => runHooksCommand(argv, { root: dir.path, sink: { write: () => true } })).toThrow(message)
    })

    it('starts each step of the hook on the running Node.js, from the workspace root, on the terminal', async () => {
      await ran(runHooksCommand, ['run', 'pre-push'])
      expect(started()).toEqual([
        {
          file: process.execPath,
          args: ['audit.mjs'],
          options: expect.objectContaining({ cwd: dir.path, stdio: 'inherit', shell: false }),
        },
        {
          file: process.execPath,
          args: ['pipeline.mjs'],
          options: expect.objectContaining({ cwd: dir.path, stdio: 'inherit', shell: false }),
        },
      ])
    })

    it('exits 0 when every step succeeded', async () => {
      expect((await ran(runHooksCommand, ['run', 'pre-push'])).code).toBe(0)
    })

    it('exits 1 when a step fails', async () => {
      children((child, script) => child.exit(script === 'audit.mjs' ? 3 : 0))
      expect((await ran(runHooksCommand, ['run', 'pre-push'])).code).toBe(1)
    })

    it('counts a step that cannot be started as failed', async () => {
      children((child) => child.emit('error', createError('spawn ENOENT')))
      expect((await ran(runHooksCommand, ['run', 'pre-push'])).written).toContain('✗ audit')
    })

    it('counts a step a signal ended as failed', async () => {
      children((child) => child.emit('close', null))
      expect((await ran(runHooksCommand, ['run', 'pre-push'])).written).toContain('✗ audit')
    })

    it('hands the arguments of the hook to a step that asks for them, with its variables over the environment', async () => {
      jest.stubEnv('HF_HOOKS_SPEC_INHERITED', 'yes')
      await ran(runHooksCommand, ['run', 'commit-msg', '.git/COMMIT_EDITMSG'])
      expect(started()).toEqual([
        {
          file: process.execPath,
          args: ['check.mjs', '.git/COMMIT_EDITMSG'],
          options: expect.objectContaining({ env: expect.objectContaining({ STRICT: '1', HF_HOOKS_SPEC_INHERITED: 'yes' }) }),
        },
      ])
    })

    it('runs only the steps --only names', async () => {
      await ran(runHooksCommand, ['run', 'pre-push', '--only=pipeline'])
      expect(started().map((child) => child.args)).toEqual([['pipeline.mjs']])
    })

    it('lists a step --skip names as skipped by it', async () => {
      expect((await ran(runHooksCommand, ['run', 'pre-push', '--skip=audit'])).written).toContain('- audit     skipped by --skip')
    })

    it('says which name of a skip is no step', async () => {
      expect((await ran(runHooksCommand, ['run', 'pre-push', '--skip=audti'])).written).toContain('--skip names no step: audti\n')
    })

    it('runs nothing and exits 0 for a hook the configuration gives no steps', async () => {
      dir.write('hooks.config.ts', "export default { 'pre-push': [] }\n")
      expect([await ran(runHooksCommand, ['run', 'pre-commit']), await ran(runHooksCommand, ['run', 'pre-push']), started()]).toEqual([
        { code: 0, written: '' },
        { code: 0, written: '' },
        [],
      ])
    })

    it('stages again the fully staged file a step fixed', async () => {
      dir.write('a.ts', 'a\n')
      execFileSync('git', ['init', '-q'], { cwd: dir.path })
      execFileSync('git', ['add', 'a.ts'], { cwd: dir.path })
      children((child) => {
        writeFileSync(join(dir.path, 'a.ts'), 'a, formatted\n')
        child.exit(0)
      })
      await ran(runHooksCommand, ['run', 'pre-commit'])
      expect(execFileSync('git', ['show', ':a.ts'], { cwd: dir.path, encoding: 'utf8' })).toBe('a, formatted\n')
    })
  })
})
