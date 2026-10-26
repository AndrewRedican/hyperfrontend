import type { PlanTask } from './model'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { executeTask, logPathOf, replayLines, runCommand, shellSafe } from './execute'

const directory = useTempDir({ prefix: 'execute-' })

/**
 * A task running a Node.js one-liner.
 *
 * @param script - The one-liner
 * @param fields - The fields that differ from the default task
 * @returns A task running the one-liner on Linux
 */
function nodeTask(script: string, fields: Partial<PlanTask> = {}): PlanTask {
  return {
    id: 'lib-a:build',
    project: 'lib-a',
    target: 'build',
    environment: 'linux',
    needs: [],
    weight: 'light',
    reasons: [],
    command: ['node', '-e', script],
    env: {},
    ...fields,
  }
}

describe('shellSafe', () => {
  it('quotes an argument with a space on Windows', () => {
    expect(shellSafe(['npx', 'a b', 'c'], 'win32')).toEqual(['npx', '"a b"', 'c'])
  })

  it('leaves the arguments alone elsewhere', () => {
    expect(shellSafe(['npx', 'a b'], 'linux')).toEqual(['npx', 'a b'])
  })
})

describe('runCommand', () => {
  it('captures what the command printed, in order', async () => {
    const result = await runCommand(['node', '-e', 'process.stdout.write("one\\n"); process.stderr.write("two\\n")'], {
      cwd: directory.path,
    })
    expect({ exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, output: result.output }).toEqual({
      exitCode: 0,
      stdout: 'one\n',
      stderr: 'two\n',
      output: 'one\ntwo\n',
    })
  })

  it('reports the exit code of a failure', async () => {
    expect((await runCommand(['node', '-e', 'process.exit(3)'], { cwd: directory.path })).exitCode).toBe(3)
  })

  it('passes the environment and the working directory', async () => {
    const result = await runCommand(['node', '-e', 'process.stdout.write(process.env.HF_PROBE + " " + process.cwd())'], {
      cwd: directory.path,
      env: { HF_PROBE: 'yes' },
    })
    expect(result.stdout).toBe(`yes ${directory.path}`)
  })

  it('reports a command that cannot start', async () => {
    const result = await runCommand(['definitely-not-a-command-' + process.pid], { cwd: directory.path })
    expect({ exitCode: result.exitCode, error: result.error?.includes('ENOENT') }).toEqual({ exitCode: null, error: true })
  })

  it('ends a command that outlives its time limit', async () => {
    const result = await runCommand(['node', '-e', 'setTimeout(() => undefined, 60000)'], { cwd: directory.path, timeoutMs: 50 })
    expect({ timedOut: result.timedOut, signal: result.signal }).toEqual({ timedOut: true, signal: 'SIGTERM' })
  })

  it('ends a command when the signal aborts', async () => {
    const controller = new AbortController()
    const pending = runCommand(['node', '-e', 'setTimeout(() => undefined, 60000)'], { cwd: directory.path, signal: controller.signal })
    controller.abort()
    expect((await pending).signal).toBe('SIGTERM')
  })

  it('never starts a command whose signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runCommand(['node', '-e', 'process.stdout.write("ran")'], { cwd: directory.path, signal: controller.signal })
    expect(result.stdout).not.toBe('ran')
  })

  it('launches through a shell on Windows', async () => {
    const options: unknown[] = []
    await runCommand(['node', '-e', '1'], {
      cwd: directory.path,
      platform: 'win32',
      spawn: (command, args, spawnOptions) => {
        options.push([command, args, spawnOptions.shell])
        return spawn(command, args, { ...spawnOptions, shell: false })
      },
    })
    expect(options).toEqual([['node', ['-e', '1'], true]])
  })
})

describe('logPathOf', () => {
  it('names the log after the task under the directory', () => {
    expect(logPathOf(nodeTask('', { id: 'lib-a:smoke-floor' }), '.hf/pipeline/logs')).toBe('.hf/pipeline/logs/lib-a__smoke-floor.log')
  })
})

describe('executeTask', () => {
  it('writes the log and reports success', async () => {
    const outcome = await executeTask(nodeTask('process.stdout.write("built")'), { root: directory.path, logDirectory: 'logs' })
    expect({ outcome, log: readFileSync(join(directory.path, 'logs/lib-a__build.log'), 'utf8') }).toEqual({
      outcome: { outcome: 'success', exitCode: 0, log: 'logs/lib-a__build.log', detail: null },
      log: 'built',
    })
  })

  it('reports a failure with its exit code', async () => {
    expect(await executeTask(nodeTask('process.exit(2)'), { root: directory.path, logDirectory: 'logs' })).toEqual({
      outcome: 'failure',
      exitCode: 2,
      log: 'logs/lib-a__build.log',
      detail: null,
    })
  })

  it('reports a command that cannot start', async () => {
    const outcome = await executeTask(nodeTask('', { command: ['definitely-not-a-command-' + process.pid] }), {
      root: directory.path,
      logDirectory: 'logs',
    })
    expect({ outcome: outcome.outcome, exitCode: outcome.exitCode, detail: outcome.detail?.includes('ENOENT') }).toEqual({
      outcome: 'failure',
      exitCode: null,
      detail: true,
    })
  })

  it('reports a cancellation', async () => {
    const controller = new AbortController()
    const pending = executeTask(nodeTask('setTimeout(() => undefined, 60000)'), {
      root: directory.path,
      logDirectory: 'logs',
      signal: controller.signal,
    })
    controller.abort()
    expect((await pending).outcome).toBe('cancelled')
  })

  it('gives the task its own environment on top of the run environment', async () => {
    await executeTask(nodeTask('process.stdout.write(process.env.CI + process.env.HF_DIST)', { env: { HF_DIST: 'dist/libs/a' } }), {
      root: directory.path,
      logDirectory: 'logs',
      env: { CI: '1' },
    })
    expect(readFileSync(join(directory.path, 'logs/lib-a__build.log'), 'utf8')).toBe('1dist/libs/a')
  })
})

describe('replayLines', () => {
  it('folds the log into a group on GitHub', () => {
    expect(replayLines('lib-a:build (success, 3s)', 'one\ntwo\n', true)).toEqual([
      '::group::lib-a:build (success, 3s)',
      'one',
      'two',
      '::endgroup::',
    ])
  })

  it('heads the log plainly elsewhere', () => {
    expect(replayLines('lib-a:build (success, 3s)', 'one', false)).toEqual(['── lib-a:build (success, 3s)', 'one'])
  })

  it('prints only the heading for an empty log', () => {
    expect(replayLines('lib-a:build (skipped)', '', true)).toEqual(['::group::lib-a:build (skipped)', '::endgroup::'])
  })
})
