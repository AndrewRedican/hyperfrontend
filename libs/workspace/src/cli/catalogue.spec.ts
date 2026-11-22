import type { Command, CommandSession } from './catalogue'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { COMMANDS, isOwnCommand, USAGE } from './catalogue'

/** A session that keeps what a command wrote. */
interface Recording {
  /** The session the command is given. */
  readonly session: CommandSession
  /** The lines of the result, in order. */
  readonly said: string[]
}

/**
 * A session over a workspace that does not exist, so a command that goes past its arguments fails.
 *
 * @returns The session and the lines of the result it kept
 */
function recording(): Recording {
  const said: string[] = []
  const session: CommandSession = {
    root: '/no-workspace',
    cwd: '/no-workspace',
    say: (line) => void said.push(line),
    note: () => undefined,
    sink: { write: () => true },
  }
  return { session, said }
}

/**
 * A command of the table with its usage.
 *
 * @param name - The word the command answers to
 * @returns The command and its usage
 */
function entryOf(name: string): readonly [Command, string] {
  return COMMANDS[name] as readonly [Command, string]
}

describe('isOwnCommand', () => {
  it.each(['run', 'run-many', 'affected', 'format', 'generate', 'show', 'graph', 'hooks', 'push'])('owns %s', (word) => {
    expect(isOwnCommand(word)).toBe(true)
  })

  it.each(['pack', 'toString', ''])('does not own %j', (word) => {
    expect(isOwnCommand(word)).toBe(false)
  })
})

describe('COMMANDS', () => {
  it('leaves out run, which the dispatch answers itself', () => {
    expect(keys(COMMANDS)).not.toContain('run')
  })

  it.each(keys(COMMANDS).flatMap((name) => ['--help', '-h'].map((word) => [name, word] as const)))(
    'answers %s %s with its usage, and runs nothing',
    async (name, word) => {
      const { session, said } = recording()
      const [command, usage] = entryOf(name)
      expect({ code: await command([word], session), said }).toEqual({ code: 0, said: [usage] })
    }
  )

  it.each(['run-many', 'affected'])('answers a help word after the selection of %s, passing it to no task', async (name) => {
    const { session, said } = recording()
    const [command, usage] = entryOf(name)
    expect({ code: await command(['-t', 'build', '--all', '--help'], session), said }).toEqual({ code: 0, said: [usage] })
  })

  it('answers a help word after the subcommand of hooks', async () => {
    const { session, said } = recording()
    const [command, usage] = entryOf('hooks')
    expect({ code: await command(['run', '-h'], session), said }).toEqual({ code: 0, said: [usage] })
  })

  it('leaves a help word among the arguments of a hook to the hook', () => {
    const { session } = recording()
    expect(() => entryOf('hooks')[0](['run', 'pre-commit', '--help'], session)).toThrow(
      'hooks run takes --only=<steps> and --skip=<steps>, got --help'
    )
  })
})

describe('USAGE', () => {
  it('lists run and every command of the table', () => {
    expect(['run', ...keys(COMMANDS)].filter((command) => !USAGE.includes(`\n  ${command} `))).toEqual([])
  })
})
