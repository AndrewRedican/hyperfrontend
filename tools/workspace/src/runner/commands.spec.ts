import type { ChildProcess, SpawnOptions } from 'node:child_process'
import type { FakeChildProcess } from '@hyperfrontend/testing/process'
import type { CommandsHost } from './commands'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { queueMicrotask } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createFakeChildProcess } from '@hyperfrontend/testing/process'
import { quoteArgument, runCommands, withArguments } from './commands'
import { pathKey, searchPath } from './environment'

/** How a fake command ends: with an exit code, never on its own, or failing to start, which Node reports as an error and then a close with a negative code. */
type Behaviour = number | 'hang' | Error

/** A command a fake host started. */
interface Spawned {
  /** The command line. */
  readonly command: string
  /** How it was started. */
  readonly options: SpawnOptions
  /** The process. */
  readonly child: FakeChildProcess
}

/** A host whose commands are fakes. */
interface FakeHost {
  /** The host. */
  readonly host: CommandsHost
  /** The commands started, in order. */
  readonly spawned: Spawned[]
  /** The lines the runner wrote. */
  readonly lines: string[]
}

/** The workspace root of the fake host. */
const ROOT = '/work'

/**
 * A host starting fake commands, each ending the way the table says, by default with code 0.
 *
 * @param behaviours - How each command ends, by command line
 * @returns The host and what it recorded
 */
function fakeHost(behaviours: Readonly<Record<string, Behaviour>> = {}): FakeHost {
  const spawned: Spawned[] = []
  const lines: string[] = []
  const host: CommandsHost = {
    root: ROOT,
    env: { PATH: '/bin', HOME: '/home/a' },
    platform: process.platform,
    execPath: process.execPath,
    spawn: (command, options) => {
      const child = createFakeChildProcess()
      spawned.push({ command, options, child })
      const behaviour = behaviours[command] ?? 0
      queueMicrotask(() => {
        if (behaviour instanceof Error) {
          child.fail(behaviour)
          child.exit(-2)
        } else if (behaviour !== 'hang') child.exit(behaviour)
      })
      return child as unknown as ChildProcess
    },
    write: (line) => {
      lines.push(line)
    },
  }
  return { host, spawned, lines }
}

/**
 * The search path a command running in a directory gets from the fake host.
 *
 * @param cwd - The directory
 * @returns The search path
 */
function expectedPath(cwd: string): string {
  return searchPath(cwd, '/bin', process.execPath, process.platform)
}

describe('quoteArgument', () => {
  it.each([
    ['--tag=next', '--tag=next'],
    ['--message=hello world', '--message="hello world"'],
    ['--say=a "b"', '--say="a \\"b\\""'],
    ["--quoted='a b'", "--quoted='a b'"],
    ['--odd name', '"--odd name"'],
  ])('writes %j as %j', (arg, quoted) => {
    expect(quoteArgument(arg)).toBe(quoted)
  })
})

describe('withArguments', () => {
  it('appends the arguments to a command without a placeholder', () => {
    expect(withArguments('npm test', ['--watch=false', '--ci'], {}, true)).toBe('npm test --watch=false --ci')
  })

  it('appends nothing to a command that does not take the arguments', () => {
    expect(withArguments('npm test', ['--ci'], {}, false)).toBe('npm test')
  })

  it('appends nothing when no argument reaches the commands', () => {
    expect(withArguments('npm test', [], {}, true)).toBe('npm test')
  })

  it('puts every argument in place of {args}', () => {
    expect(withArguments('npm test -- {args} --done', ['--a=1', '--b'], {}, true)).toBe('npm test -- --a=1 --b --done')
  })

  it('puts each named value in place of its placeholder, and nothing for a name not given', () => {
    expect(withArguments('deploy {args.target} {args.missing}x', ['--target=prod'], { target: 'prod' }, true)).toBe('deploy prod x')
  })

  it('refuses a command holding both kinds of placeholder', () => {
    expect(() => withArguments('x {args} {args.a}', [], {}, true)).toThrow(
      'x {args} {args.a} holds both {args} and {args.<name>} placeholders; use one kind'
    )
  })
})

describe('runCommands', () => {
  it('runs a command through the shell from the workspace root, its output going where the runner writes', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'npm audit' }, [], host)
    expect(spawned.map(({ command, options }) => [command, options.cwd, options.shell, options.stdio, options.windowsHide])).toEqual([
      ['npm audit', ROOT, true, 'inherit', true],
    ])
  })

  it('reports every command before it runs', async () => {
    const { host, lines } = fakeHost()
    await runCommands({ commands: ['a', 'b'], parallel: false }, [], host)
    expect(lines).toEqual(['> a', '> b'])
  })

  it('succeeds when the command exits with code 0', async () => {
    expect(await runCommands({ command: 'npm audit' }, [], fakeHost().host)).toBe(true)
  })

  it('joins a command written as a list of words', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: ['npm', 'audit'] }, [], host)
    expect(spawned.map(({ command }) => command)).toEqual(['npm audit'])
  })

  it('runs from the cwd taken under the workspace root', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'npm audit', cwd: 'libs/a' }, [], host)
    expect(spawned[0]?.options.cwd).toBe(join(ROOT, 'libs/a'))
  })

  it('runs from an absolute cwd as it is', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'npm audit', cwd: '/elsewhere' }, [], host)
    expect(spawned[0]?.options.cwd).toBe('/elsewhere')
  })

  it('puts the bin directories of the directory it runs in first on the search path', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'npm audit', cwd: 'libs/a' }, [], host)
    expect(spawned[0]?.options.env?.[pathKey(host.env, host.platform)]).toBe(expectedPath(join(ROOT, 'libs/a')))
  })

  it('adds the target env without letting it replace the search path', async () => {
    const { host, spawned } = fakeHost()
    const key = pathKey(host.env, host.platform)
    await runCommands({ command: 'npm audit', env: { MODE: 'ci', [key]: '/elsewhere' } }, [], host)
    const env = spawned[0]?.options.env
    expect({ mode: env?.['MODE'], home: env?.['HOME'], path: env?.[key] }).toEqual({
      mode: 'ci',
      home: '/home/a',
      path: expectedPath(ROOT),
    })
  })

  it('runs commands one after another when parallel is false, stopping at the first failure', async () => {
    const { host, spawned } = fakeHost({ b: 2 })
    const succeeded = await runCommands({ commands: ['a', 'b', 'c'], parallel: false }, [], host)
    expect({ succeeded, started: spawned.map(({ command }) => command) }).toEqual({ succeeded: false, started: ['a', 'b'] })
  })

  it('succeeds when every command of a sequence succeeds', async () => {
    expect(await runCommands({ commands: ['a', 'b'], parallel: false }, [], fakeHost().host)).toBe(true)
  })

  it('reports the exit code of a command that fails', async () => {
    const { host, lines } = fakeHost({ b: 2 })
    await runCommands({ commands: ['a', 'b'], parallel: false }, [], host)
    expect(lines).toEqual(['> a', '> b', 'exited with 2: b'])
  })

  it('runs a commands list side by side by default', async () => {
    const { host, spawned } = fakeHost({ a: 'hang', b: 'hang' })
    const pending = runCommands({ commands: ['a', 'b'] }, [], host)
    const started = spawned.map(({ command }) => command)
    for (const { child } of spawned) child.exit(0)
    await pending
    expect(started).toEqual(['a', 'b'])
  })

  it('succeeds when every command side by side succeeds', async () => {
    expect(await runCommands({ commands: ['a', 'b'] }, [], fakeHost().host)).toBe(true)
  })

  it('ends the commands still running when one side by side fails', async () => {
    const { host, spawned } = fakeHost({ a: 1, b: 'hang' })
    const succeeded = await runCommands({ commands: ['a', 'b'] }, [], host)
    expect({ succeeded, killed: spawned[1]?.child.kill.mock.calls }).toEqual({ succeeded: false, killed: [['SIGTERM']] })
  })

  it('reports the signal that ended a command', async () => {
    const { host, lines } = fakeHost({ a: 1, b: 'hang' })
    await runCommands({ commands: ['a', 'b'] }, [], host)
    expect(lines).toContain('exited with SIGTERM: b')
  })

  it('ends the others only once when two commands side by side fail', async () => {
    const { host, spawned } = fakeHost({ a: 1, b: 1, c: 'hang' })
    const succeeded = await runCommands({ commands: ['a', 'b', 'c'] }, [], host)
    expect({ succeeded, killed: spawned[2]?.child.kill.mock.calls.length }).toEqual({ succeeded: false, killed: 1 })
  })

  it('fails a command that cannot start, reporting the failure once though the command still closes', async () => {
    const { host, lines, spawned } = fakeHost({ a: createError('spawn sh ENOENT') })
    const pending = runCommands({ command: 'a' }, [], host)
    const closed = createPromise((resolve) => spawned[0]?.child.once('close', resolve))
    const succeeded = await pending
    await closed
    expect({ succeeded, lines }).toEqual({ succeeded: false, lines: ['> a', 'could not start a: spawn sh ENOENT'] })
  })

  it('succeeds at once for an empty commands list', async () => {
    const { host, spawned } = fakeHost()
    const succeeded = await runCommands({ commands: [] }, [], host)
    expect({ succeeded, spawned: spawned.length }).toEqual({ succeeded: true, spawned: 0 })
  })

  it('refuses a target naming no command', async () => {
    await expect(runCommands({ cwd: 'libs/a' }, [], fakeHost().host)).rejects.toThrow(
      'a run-commands target needs a command or a commands list'
    )
  })

  it('refuses the options it does not implement', async () => {
    await expect(runCommands({ command: 'a', readyWhen: 'ready', color: true }, [], fakeHost().host)).rejects.toThrow(
      'run-commands options not supported: readyWhen, color'
    )
  })

  it('refuses the command fields it does not implement', async () => {
    await expect(runCommands({ commands: [{ command: 'a', prefix: 'x' }] }, [], fakeHost().host)).rejects.toThrow(
      'run-commands command fields not supported: prefix'
    )
  })

  it('appends the arguments after the task, quoted for the shell', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'node scripts/x.mjs' }, ['--message=hello world', '--ci'], host)
    expect(spawned[0]?.command).toBe('node scripts/x.mjs --message="hello world" --ci')
  })

  it('fills the named placeholders from the arguments after the task', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'deploy {args.target} --ci={args.ci}' }, ['--target=prod', '--ci'], host)
    expect(spawned[0]?.command).toBe('deploy prod --ci=true')
  })

  it('appends no argument to the commands when forwardAllArgs is false', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'a', forwardAllArgs: false }, ['--ci'], host)
    expect(spawned[0]?.command).toBe('a')
  })

  it('reads forwardAllArgs per command written as an object', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ commands: [{ command: 'a', forwardAllArgs: false, description: 'first' }, 'b'], parallel: false }, ['--ci'], host)
    expect(spawned.map(({ command }) => command)).toEqual(['a', 'b --ci'])
  })

  it('lets an argument after the task set the cwd', async () => {
    const { host, spawned } = fakeHost()
    await runCommands({ command: 'a', cwd: 'libs/a' }, ['--cwd=libs/b'], host)
    expect(spawned[0]?.options.cwd).toBe(join(ROOT, 'libs/b'))
  })

  it('lets an argument after the task run a commands list in sequence', async () => {
    const { host, spawned } = fakeHost({ a: 1 })
    await runCommands({ commands: ['a', 'b'] }, ['--parallel=false'], host)
    expect(spawned.map(({ command }) => command)).toEqual(['a'])
  })

  it('refuses an argument after the task setting an option only the target may set', async () => {
    await expect(runCommands({ command: 'a' }, ['--env=x'], fakeHost().host)).rejects.toThrow(
      '--env cannot be set after the task of a run-commands target'
    )
  })
})

describe('runCommands through the platform shell', () => {
  const directory = useTempDir({ prefix: 'commands-' })

  it('runs the command in the directory with the environment it is given', async () => {
    await runCommands(
      { command: `node -e "require('fs').writeFileSync('probe.txt', process.env.HF_PROBE)"`, env: { HF_PROBE: 'ran' } },
      [],
      {
        root: directory.path,
        env: process.env,
        platform: process.platform,
        execPath: process.execPath,
        spawn: (command, options) => spawn(command, options),
        write: () => undefined,
      }
    )
    expect(directory.read('probe.txt')).toBe('ran')
  })
})
