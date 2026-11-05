/**
 * An `nx:run-commands` line means the same to `sh` and to cmd.exe: the runner starts every line
 * through the platform shell, `sh` on Linux and macOS and cmd.exe on Windows, so a quote, a
 * variable, a separator, a glob or an escape that only one of them reads changes what runs.
 *
 * @module rules/projects/command-lines
 */

import type { JsonNode, JsonObjectNode } from '@hyperfrontend/json-utils'
import type { JsonTreeNode } from '@hyperfrontend/linter'
import type { JsonStringNode } from '@hyperfrontend/linter/helpers'
import type { Selector } from '../workspace/shared/cross-platform/project.ts'
import { basename } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { isString, propertyOf, rootObject } from '@hyperfrontend/linter/helpers'
import { checkedProject } from '../workspace/shared/cross-platform/project.ts'

/** The rule's options. */
export interface CommandLinesOptions {
  /** The project files checked; replaces the default of every publishable library. */
  readonly include?: readonly Selector[]
}

/** What `sh` and cmd.exe read differently, by message. */
export const MESSAGES = {
  singleQuote:
    'This line runs through sh on Linux and macOS and through cmd.exe on Windows, which passes single quotes through as part of the argument. Quote with double quotes, which both shells strip.',
  envPrefix:
    "This line runs through sh on Linux and macOS and through cmd.exe on Windows, which has no `NAME=value command` prefix. Set the variable in the target's `env` option.",
  variable:
    "This line runs through sh on Linux and macOS and through cmd.exe on Windows, and each expands only its own `$NAME` or `%NAME%`. Pass the value through the target's `env` option or an `{args.name}` placeholder.",
  separator:
    'This line runs through sh on Linux and macOS and through cmd.exe on Windows, which read `;` and a lone `&` differently. Chain with `&&`, which both read as run-on-success, or list the lines under `commands`.',
  glob: 'This line runs through sh on Linux and macOS and through cmd.exe on Windows, and only sh expands an unquoted `*` or `?`. Double-quote the pattern and let the program match it.',
  backslash:
    'This line runs through sh on Linux and macOS and through cmd.exe on Windows, and sh reads an unquoted backslash as an escape. Write paths with `/`, which Node and npm accept on Windows.',
} as const

/** A problem a command line can have. */
type Problem = keyof typeof MESSAGES

/** A leading `NAME=value` assignment. */
const ENV_PREFIX = /^\s*[A-Za-z_]\w*=/

/** A variable reference in either shell's syntax. */
const VARIABLE = /\$[A-Za-z_{(]|%[A-Za-z_]\w*%/

/**
 * What a command line holds that `sh` and cmd.exe read differently. Variables count anywhere,
 * since both shells expand inside double quotes; the rest only outside them.
 *
 * @param line - The command line
 * @returns The problems, each once, in the order first met
 */
function problemsOf(line: string): Problem[] {
  const found = createSet<Problem>()
  if (ENV_PREFIX.test(line)) found.add('envPrefix')
  if (VARIABLE.test(line)) found.add('variable')
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"') quoted = !quoted
    else if (quoted) continue
    else if (character === "'") found.add('singleQuote')
    else if (character === ';') found.add('separator')
    else if (character === '&' && line[index - 1] !== '&' && line[index - 1] !== '>' && line[index + 1] !== '&') found.add('separator')
    else if (character === '*' || character === '?') found.add('glob')
    else if (character === '\\') found.add('backslash')
  }
  return [...found]
}

/**
 * The command lines of a target: its `command`, the `command` of its options, and each entry of
 * their `commands`, written as a string or as an object with a `command`.
 *
 * @param target - The target's object
 * @returns The string nodes holding command lines
 */
function linesOf(target: JsonObjectNode): JsonStringNode[] {
  const options = propertyOf(target, 'options')?.value
  const holders = options?.kind === 'object' ? [target, options] : [target]
  const lines: JsonNode[] = []
  for (const holder of holders) {
    const command = propertyOf(holder, 'command')?.value
    if (command !== undefined) lines.push(command)
    const commands = propertyOf(holder, 'commands')?.value
    if (commands?.kind !== 'array') continue
    for (const entry of commands.elements) {
      const nested = entry.kind === 'object' ? propertyOf(entry, 'command')?.value : entry
      if (nested !== undefined) lines.push(nested)
    }
  }
  return lines.filter(isString)
}

export default defineRule<CommandLinesOptions | undefined, JsonTreeNode>({
  id: 'projects/command-lines',
  language: 'json',
  fixable: false,
  create(context) {
    if (basename(context.file.path) !== 'project.json') return {}
    if (checkedProject(context.file.path, context.options?.include ?? [{ publishableLibraries: true }]) === null) return {}
    return {
      document(node) {
        const root = rootObject(node)
        const targets = root === null ? undefined : propertyOf(root, 'targets')?.value
        if (targets?.kind !== 'object') return
        for (const target of targets.properties) {
          if (target.value.kind !== 'object') continue
          for (const line of linesOf(target.value)) {
            for (const problem of problemsOf(line.value)) context.report({ start: line.start, end: line.end, message: MESSAGES[problem] })
          }
        }
      },
    }
  },
})
