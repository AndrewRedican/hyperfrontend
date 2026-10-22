/**
 * Whitespace other than spaces, tabs and line breaks, such as a no-break space or a zero-width
 * space, is invisible in most editors yet breaks tokens and layouts; a string literal may hold
 * it on purpose.
 *
 * @module rules/javascript/no-irregular-whitespace
 */

import type { Node } from '../../code/model.ts'
import type { Location } from '../../engine/report.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'

/** The rule's options. */
export interface NoIrregularWhitespaceOptions {
  /** Whether string literals may hold irregular whitespace; they may unless this is false. */
  readonly skipStrings?: boolean
}

/** A run of irregular whitespace, with the position the previous linter gave it. */
interface Run {
  /** The offset of its first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
  /** Its position, with the two irregular line terminators counted as line breaks. */
  readonly at: Location
}

/** The irregular whitespace characters outside the U+2000 to U+200B range. */
const SINGLES = createSet<string>(['\f', '\v', '\u0085', ' ', '᠎', ' ', ' ', '　', '﻿'])

export default defineRule<NoIrregularWhitespaceOptions | undefined, Node>({
  id: 'no-irregular-whitespace',
  language: 'code',
  fixable: false,
  create(context) {
    const skipStrings = context.options?.skipStrings !== false
    const strings: Node[] = []
    return {
      Literal(node) {
        if (skipStrings && typeof node.value === 'string') strings.push(node)
      },
      'Program:exit'() {
        for (const run of runsIn(context.file.text)) {
          if (strings.some((literal) => run.start >= literal.start && run.start < literal.end)) continue
          context.report({ start: run.start, end: run.end, at: run.at, message: 'Irregular whitespace not allowed.' })
        }
      },
    }
  },
})

/**
 * Whether a character is irregular whitespace other than a line terminator.
 *
 * @param character - One character
 * @returns Whether the rule reports it
 */
function isIrregular(character: string): boolean {
  const code = character.charCodeAt(0)
  return (code >= 0x2000 && code <= 0x200b) || SINGLES.has(character)
}

/**
 * The runs of irregular whitespace in a text, each line terminator U+2028 or U+2029 a run of its
 * own that ends the line it closes, as the previous linter counted lines.
 *
 * @param text - The file's text
 * @returns The runs, in source order
 */
function runsIn(text: string): Run[] {
  const runs: Run[] = []
  let line = 1
  let lineStart = 0
  let index = 0
  while (index < text.length) {
    const character = text[index] as string
    if (character === '\n') {
      line += 1
      lineStart = index + 1
      index += 1
    } else if (character === ' ' || character === ' ') {
      runs.push({ start: index, end: index + 1, at: { line, column: index - lineStart + 1, endLine: line + 1, endColumn: 1 } })
      line += 1
      lineStart = index + 1
      index += 1
    } else if (isIrregular(character)) {
      const start = index
      while (index < text.length && isIrregular(text[index] as string)) index += 1
      runs.push({ start, end: index, at: { line, column: start - lineStart + 1, endLine: line, endColumn: index - lineStart + 1 } })
    } else {
      index += 1
    }
  }
  return runs
}
