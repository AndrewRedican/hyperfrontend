/**
 * A `RegExp` built from a string the engine refuses, or with flags it does not know, throws
 * when the code runs; the message names what the engine objects to.
 *
 * @module rules/javascript/no-invalid-regexp
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { parse } from '../../regex/parse'
import { validate } from '../../regex/validate'
import { scopeAnalysisOf } from '../../scope/analysis'
import { isRegExpIdentifier, stringLiteralValue } from './shared/regexp-construction'

/** The flags the language knows. */
const KNOWN_FLAGS = createSet('dgimsuvy'.split(''))

/**
 * What is wrong with a flags string: `u` beside `v`, a known flag repeated, or a flag unknown.
 *
 * @param flags - The flags as written
 * @returns The message, or null when the flags pass
 */
function flagsProblem(flags: string): string | null {
  if (flags.includes('u') && flags.includes('v')) return "Regex 'u' and 'v' flags cannot be used together."
  let duplicates = ''
  let unknown = ''
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index] as string
    if (!KNOWN_FLAGS.has(flag)) unknown += flag
    else if (flags.indexOf(flag) !== index) duplicates += flag
  }
  if (duplicates !== '') return `Duplicate flags ('${duplicates}') supplied to RegExp constructor.`
  return unknown === '' ? null : `Invalid flags supplied to RegExp constructor '${unknown}'.`
}

/**
 * Why the engine refuses a pattern under flags, in the words the pattern grammar uses where it
 * finds the fault itself and in the engine's otherwise.
 *
 * @param pattern - The pattern text
 * @param flags - The flags the pattern is read under
 * @returns The message, or null when the engine takes the pair
 */
function patternProblem(pattern: string, flags: string): string | null {
  const refused = validate(pattern, flags)
  if (refused === null) return null
  const reason = parse(pattern, flags).error?.message ?? refused.slice(refused.lastIndexOf(': ') + 2)
  // why: the message names the grammar the pattern was read in, which only the unicode flags select.
  const mode = flags.includes('v') ? 'v' : flags.includes('u') ? 'u' : ''
  return `Invalid regular expression: /${pattern}/${mode}: ${reason}.`
}

/**
 * Why a pattern is refused when its flags are unknown: it passes when some grammar takes it.
 *
 * @param pattern - The pattern text
 * @returns The message under no flags, or null when some flags take the pattern
 */
function patternProblemUnderAnyFlags(pattern: string): string | null {
  return patternProblem(pattern, 'u') === null || patternProblem(pattern, 'v') === null ? null : patternProblem(pattern, '')
}

export default defineRule<undefined, Node>({
  id: 'no-invalid-regexp',
  language: 'code',
  fixable: false,
  create(context) {
    const call = (node: Node): void => {
      if (!isRegExpIdentifier(scopeAnalysisOf(context), node.callee as Node)) return
      const [first, second] = node.arguments as readonly Node[]
      // why: flags left out are none; flags given as anything but a string literal are unknown.
      const flags = second === undefined ? '' : stringLiteralValue(second)
      const pattern = stringLiteralValue(first)
      let message = flags === null ? null : flagsProblem(flags)
      if (message === null && pattern !== null)
        message = flags === null ? patternProblemUnderAnyFlags(pattern) : patternProblem(pattern, flags)
      if (message !== null) context.report({ start: node.start, end: node.end, message })
    }
    return { CallExpression: call, NewExpression: call }
  },
})
