import type { ChildProcess } from 'node:child_process'
import type { Spawn } from './execute'
import type { PlanTask } from './model'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { executeTask, logPathOf, needsShell, replayLines, runCommand, shellSafe } from './execute'

const directory = useTempDir({ prefix: 'execute-' })

/** A command that runs until something ends it. */
const LINGERING = ['node', '-e', 'setTimeout(() => undefined, 60000)']

/**
 * Pauses.
 *
 * @param ms - How long, in milliseconds
 * @returns Resolves after the pause
 */
function pause(ms: number): Promise<void> {
  return createPromise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * A process boundary that starts the command for real, without a shell, and records each start.
 *
 * @param started - Receives every child started, in order
 * @returns The boundary
 */
function recordingSpawn(started: ChildProcess[]): Spawn {
  return (command, args, spawnOptions) => {
    const child = spawn(command, args, { ...spawnOptions, shell: false })
    started.push(child)
    return child
  }
}

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
    const result = await runCommand(LINGERING, { cwd: directory.path, timeoutMs: 50 })
    expect({ timedOut: result.timedOut, ended: result.signal !== null || result.exitCode !== 0 }).toEqual({ timedOut: true, ended: true })
  })

  it('ends a command when the signal aborts', async () => {
    const controller = new AbortController()
    const pending = runCommand(LINGERING, { cwd: directory.path, signal: controller.signal })
    controller.abort()
    const result = await pending
    expect(result.signal !== null || result.exitCode !== 0).toBe(true)
  })

  it('ends the processes a command started when the signal aborts', async () => {
    const beat = join(directory.path, 'beat.txt')
    const grandchild = join(directory.path, 'grandchild.cjs')
    const parent = join(directory.path, 'parent.cjs')
    writeFileSync(
      grandchild,
      `let beats = 0\nsetInterval(() => require('node:fs').writeFileSync(${stringify(beat)}, \`\${++beats}\`), 20)\n`
    )
    writeFileSync(
      parent,
      `require('node:child_process').spawn(process.execPath, [${stringify(grandchild)}], { stdio: 'ignore' })\nsetInterval(() => undefined, 1000)\n`
    )
    const controller = new AbortController()
    const pending = runCommand(['node', parent], { cwd: directory.path, signal: controller.signal })
    for (let waited = 0; !existsSync(beat) && waited < 5000; waited += 25) await pause(25)
    controller.abort()
    await pending
    await pause(200)
    const before = readFileSync(beat, 'utf8')
    await pause(300)
    expect(readFileSync(beat, 'utf8')).toBe(before)
  })

  it('starts the command as the leader of its own process group on POSIX', async () => {
    const options: unknown[] = []
    await runCommand(['node', '-e', '1'], {
      cwd: directory.path,
      platform: 'linux',
      spawn: (command, args, spawnOptions) => {
        options.push(spawnOptions.detached)
        return spawn(command, args, spawnOptions)
      },
    })
    expect(options).toEqual([true])
  })

  it('signals the process group of the command on POSIX', async () => {
    const started: ChildProcess[] = []
    const signals: unknown[] = []
    const controller = new AbortController()
    const pending = runCommand(LINGERING, {
      cwd: directory.path,
      platform: 'linux',
      signal: controller.signal,
      spawn: recordingSpawn(started),
      kill: (pid, signal) => {
        signals.push([pid, signal])
        started[0]?.kill(signal)
      },
    })
    controller.abort()
    await pending
    expect(signals).toEqual([[-(started[0]?.pid as number), 'SIGTERM']])
  })

  it('takes a process group that is already gone as ended', async () => {
    const started: ChildProcess[] = []
    const controller = new AbortController()
    const pending = runCommand(LINGERING, {
      cwd: directory.path,
      platform: 'linux',
      signal: controller.signal,
      spawn: recordingSpawn(started),
      kill: () => {
        started[0]?.kill('SIGTERM')
        throw new Error('kill ESRCH')
      },
    })
    controller.abort()
    expect((await pending).error).toBeNull()
  })

  it('signals nothing for a command that never started', async () => {
    const signals: unknown[] = []
    const controller = new AbortController()
    controller.abort()
    await runCommand(['definitely-not-a-command-' + process.pid], {
      cwd: directory.path,
      platform: 'linux',
      signal: controller.signal,
      kill: (pid, signal) => signals.push([pid, signal]),
    })
    expect(signals).toEqual([])
  })

  it('ends the process tree through taskkill on Windows', async () => {
    const started: ChildProcess[] = []
    const requests: unknown[] = []
    const controller = new AbortController()
    const pending = runCommand(LINGERING, {
      cwd: directory.path,
      platform: 'win32',
      signal: controller.signal,
      spawn: (command, args, spawnOptions) => {
        if (command !== 'taskkill') return recordingSpawn(started)(command, args, spawnOptions)
        requests.push([command, args])
        started[0]?.kill('SIGTERM')
        // why: a taskkill that cannot start must not crash the run, so the stand-in reports an error as soon as one is listened for
        return {
          on: (_event: string, listener: (error: Error) => void) => listener(new Error('spawn taskkill ENOENT')),
        } as unknown as ChildProcess
      },
    })
    controller.abort()
    await pending
    expect(requests).toEqual([['taskkill', ['/pid', `${started[0]?.pid}`, '/T', '/F']]])
  })

  it('never starts a command whose signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runCommand(['node', '-e', 'process.stdout.write("ran")'], { cwd: directory.path, signal: controller.signal })
    expect(result.stdout).not.toBe('ran')
  })

  it('starts a command directly on Windows, its arguments unquoted', async () => {
    const options: unknown[] = []
    await runCommand(['node', '-e', 'process.stdout.write("a b")'], {
      cwd: directory.path,
      platform: 'win32',
      spawn: (command, args, spawnOptions) => {
        options.push([command, args, spawnOptions.shell, spawnOptions.detached])
        return spawn(command, args, { ...spawnOptions, shell: false })
      },
    })
    expect(options).toEqual([['node', ['-e', 'process.stdout.write("a b")'], false, false]])
  })

  it('launches a shim through a shell on Windows, quoting what holds a space', async () => {
    const options: unknown[] = []
    await runCommand(['npx', '-p', 'a b'], {
      cwd: directory.path,
      platform: 'win32',
      spawn: (command, args, spawnOptions) => {
        options.push([command, args, spawnOptions.shell])
        return spawn('node', ['-e', '1'], { ...spawnOptions, shell: false })
      },
    })
    expect(options).toEqual([['npx', ['-p', '"a b"'], true]])
  })
})

describe('needsShell', () => {
  it('asks for a shell for npm and npx on Windows', () => {
    expect([needsShell(['npm', 'view'], 'win32'), needsShell(['npx', '-y'], 'win32')]).toEqual([true, true])
  })

  it('starts everything else directly', () => {
    expect([needsShell(['node', '-e', '1'], 'win32'), needsShell(['npx', '-y'], 'linux')]).toEqual([false, false])
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
