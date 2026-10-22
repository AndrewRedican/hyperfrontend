/**
 * An `@name` inside a description reads as a tag to documentation tools: an unescaped one is
 * reported with the three ways to write it, unless its name is allowed, as package scopes are.
 *
 * @module rules/jsdoc/escape-inline-tags
 */

import type { Node } from '../../code/model.ts'
import type { JsdocTag } from '../../jsdoc/parse.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportLineNumber } from './shared/report.ts'

/** The options the rule takes. */
interface Options {
  /** Names written after `@` that are left as they are. */
  readonly allowedInlineTags?: readonly string[]
}

/**
 * The names written unescaped after `@` in a text: an `@` at the start or after whitespace,
 * followed by word characters.
 *
 * @param text - The text searched
 * @returns The names, in order, repeats included
 */
function unescapedNames(text: string): string[] {
  const names: string[] = []
  for (let at = text.indexOf('@'); at !== -1; at = text.indexOf('@', at + 1)) {
    if (at > 0 && !/\s/.test(text[at - 1] as string)) continue
    let end = at + 1
    while (end < text.length && /\w/.test(text[end] as string)) end += 1
    if (end > at + 1) names.push(text.slice(at + 1, end))
  }
  return names
}

/**
 * The message for an unescaped name.
 *
 * @param name - The name written after `@`
 * @returns The text shown
 */
function messageFor(name: string): string {
  return `Unexpected inline JSDoc tag. Did you mean to use {@${name}}, \\@${name}, or \`@${name}\`?`
}

export default defineRule<Options | undefined, Node>({
  id: 'jsdoc/escape-inline-tags',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      const allowed = context.options?.allowedInlineTags ?? []
      for (const { block } of fileBlocks(context)) {
        const first = block.tags[0] as JsdocTag | undefined
        const described = block.lines.slice(0, first === undefined ? block.lines.length : first.index)
        // why: as the previous linter counted them, an empty opening line is left out and each description line is placed one below its index.
        const counted = described[0]?.tokens.description === '' ? described.slice(1) : described
        const commentLine = (block.lines[0] as JsdocTag['lines'][number]).number
        counted.forEach((line, index) => {
          for (const name of unescapedNames(line.tokens.description)) {
            if (!allowed.includes(name)) reportLineNumber(context, commentLine + index + 1, messageFor(name))
          }
        })
        for (const tag of block.tags) {
          if (tag.tag === 'example') continue
          const reported = createSet<string>()
          for (const line of tag.lines) {
            for (const name of unescapedNames(line.tokens.description)) {
              if (allowed.includes(name) || reported.has(name)) continue
              reported.add(name)
              reportLineNumber(context, line.number, messageFor(name))
            }
          }
        }
      }
    },
  }),
})
