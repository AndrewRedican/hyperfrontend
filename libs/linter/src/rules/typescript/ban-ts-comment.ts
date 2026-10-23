/**
 * A `@ts-` directive comment changes what the compiler reports: `@ts-ignore` is reported in
 * favour of `@ts-expect-error`, which fails once the line it covers is fixed; `@ts-expect-error`
 * needs a description of at least three characters; the `@ts-nocheck` pragma is reported where
 * the compiler honours it, before the first statement; `@ts-check` passes.
 *
 * @module rules/typescript/ban-ts-comment
 */

import type { Node } from '../../code/model'
import type { SourceComment } from '../../config/directives'
import type { RuleFile } from '../../engine/rule'
import { defineRule } from '../../engine/rule'
import { positionAt } from '../../text/lines'

/** A directive found in a comment. */
interface FoundDirective {
  /** The directive's name after `@ts-`. */
  readonly name: string
  /** The text after the name on its line. */
  readonly description: string
}

/** How many characters, counted in graphemes, an `@ts-expect-error` description needs. */
const MINIMUM_DESCRIPTION_LENGTH = 3

/** A suppression directive in a line comment: slashes, spaces, the directive, the rest of the line. */
const LINE_SUPPRESSION = /^\/*\s*@ts-(?<name>expect-error|ignore)(?<description>.*)/

/** A suppression directive on the last line of a block comment: spaces, slashes or stars, spaces, the directive. */
const BLOCK_SUPPRESSION = /^\s*[/*]*\s*@ts-(?<name>expect-error|ignore)(?<description>.*)/

/** A pragma as the compiler reads it: a line comment of two or three slashes, spaces, the directive. */
const PRAGMA = /^\/\/\/?\s*@ts-(?<name>check|nocheck)(?<description>.*)/

/** Splits text into graphemes, so that one emoji counts as one character. */
const GRAPHEMES = new Intl.Segmenter()

export default defineRule<undefined, Node>({
  id: 'typescript/ban-ts-comment',
  language: 'code',
  fixable: false,
  create(context) {
    const { file } = context
    return {
      Program(node) {
        const first = (node.body as readonly Node[])[0]
        for (const comment of file.comments) {
          const found = directiveOf(file, comment)
          if (found === null) continue
          const { start, end } = comment
          if (found.name === 'ignore') {
            context.report({
              start,
              end,
              message:
                'Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do nothing if the following line is error-free.',
            })
          } else if (found.name === 'nocheck') {
            if (first !== undefined && positionAt(file.lines, first.start).line <= positionAt(file.lines, start).line) continue
            context.report({ start, end, message: 'Do not use "@ts-nocheck" because it alters compilation errors.' })
          } else if (found.name === 'expect-error' && lengthOf(found.description.trim()) < MINIMUM_DESCRIPTION_LENGTH) {
            context.report({
              start,
              end,
              message:
                'Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary. ' +
                `The description must be ${MINIMUM_DESCRIPTION_LENGTH} characters or longer.`,
            })
          }
        }
      },
    }
  },
})

/**
 * The directive a comment carries, if any: a pragma or a suppression in a line comment, a
 * suppression on the last line of a block comment.
 *
 * @param file - The file linted
 * @param comment - The comment read
 * @returns The directive and its description, or null
 */
function directiveOf(file: RuleFile, comment: SourceComment): FoundDirective | null {
  if (file.text[comment.start + 1] === '*') {
    const lines = comment.text.split(/\r?\n/)
    return matchOf(BLOCK_SUPPRESSION, lines[lines.length - 1] as string)
  }
  return matchOf(PRAGMA, `//${comment.text}`) ?? matchOf(LINE_SUPPRESSION, comment.text)
}

/**
 * Runs one of the directive patterns over a line.
 *
 * @param pattern - The pattern, with `name` and `description` groups
 * @param line - The text matched
 * @returns The groups, or null when the pattern does not match
 */
function matchOf(pattern: RegExp, line: string): FoundDirective | null {
  const match = pattern.exec(line)
  if (match === null) return null
  const groups = match.groups as Record<string, string>
  return { name: groups['name'], description: groups['description'] }
}

/**
 * The length of a text in graphemes.
 *
 * @param text - The text measured
 * @returns How many user-perceived characters it holds
 */
function lengthOf(text: string): number {
  return [...GRAPHEMES.segment(text)].length
}
