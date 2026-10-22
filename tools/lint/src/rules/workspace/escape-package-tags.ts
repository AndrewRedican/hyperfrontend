/**
 * A scoped package named bare in a JSDoc description reads as a tag to every JSDoc parser; the
 * reference is wrapped in backticks, which is the escape the docs site renders as code.
 *
 * @module rules/workspace/escape-package-tags
 */

import type { Node } from '../../code/model.ts'
import type { SourceComment } from '../../config/directives.ts'
import { defineRule } from '../../engine/rule.ts'
import { isJsdocComment } from './shared/comments.ts'

/** The rule's options. */
export interface EscapePackageTagsOptions {
  /** The package scopes that must never appear bare in a description. */
  readonly prefixes?: readonly string[]
}

/** A bare reference found in a description. */
interface Reference {
  /** The offset of its first character, the backslash of an escape included. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
  /** The specifier named, without escape or backticks. */
  readonly specifier: string
}

/** The scopes guarded when the options name none. */
const DEFAULT_PREFIXES: readonly string[] = ['@hyperfrontend']

export default defineRule<EscapePackageTagsOptions | undefined, Node>({
  id: 'workspace/escape-package-tags',
  language: 'code',
  fixable: true,
  create(context) {
    const prefixes = context.options?.prefixes ?? DEFAULT_PREFIXES
    return {
      Program() {
        for (const comment of context.file.comments) {
          if (!isJsdocComment(context.file, comment)) continue
          for (const reference of bareReferences(context.file.text, comment, prefixes)) {
            context.report({
              start: reference.start,
              end: reference.end,
              message: `Wrap \`${reference.specifier}\` in backticks. Left bare it is parsed as a JSDoc tag, and a backslash escape leaks into the rendered docs.`,
              fix: { start: reference.start, end: reference.end, text: `\`${reference.specifier}\`` },
            })
          }
        }
      },
    }
  },
})

/**
 * Whether a character is a letter or a digit.
 *
 * @param character - The character classified
 * @returns True for `A` to `Z`, `a` to `z` and `0` to `9`
 */
function isAlphanumeric(character: string): boolean {
  return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9')
}

/**
 * Whether a character can continue the name part of a specifier.
 *
 * @param character - The character classified
 * @returns True for a letter, a digit, a hyphen or an underscore
 */
function isNameCharacter(character: string): boolean {
  return isAlphanumeric(character) || character === '-' || character === '_'
}

/**
 * Whether a character is a space or a tab.
 *
 * @param character - The character classified
 * @returns True for either
 */
function isBlank(character: string): boolean {
  return character === ' ' || character === '\t'
}

/**
 * Where the text of a comment line starts: after its indentation, its asterisk and one space.
 *
 * @param text - The file's text
 * @param start - The offset of the line's first character
 * @param end - The offset after its last character
 * @returns The offset of the first character of text
 */
function contentStart(text: string, start: number, end: number): number {
  let index = start
  while (index < end && isBlank(text[index] as string)) index += 1
  if (index < end && text[index] === '*') {
    index += 1
    if (index < end && isBlank(text[index] as string)) index += 1
  }
  return index
}

/**
 * How far a specifier extends from a prefix: through a sub-path of name characters, dots and
 * slashes, trailing punctuation left out.
 *
 * @param text - The file's text
 * @param start - The offset of the prefix's `@`
 * @param prefix - The prefix matched there
 * @param lineEnd - The offset after the line's last character
 * @returns The offset after the specifier, or -1 when the prefix only starts a longer word
 */
function specifierEnd(text: string, start: number, prefix: string, lineEnd: number): number {
  const prefixEnd = start + prefix.length
  let end = prefixEnd
  if (end < lineEnd && isNameCharacter(text[end] as string)) return -1
  if (end < lineEnd && text[end] === '/') {
    end += 1
    while (end < lineEnd && (isNameCharacter(text[end] as string) || text[end] === '.' || text[end] === '/')) end += 1
  }
  while (end > prefixEnd && !isAlphanumeric(text[end - 1] as string)) end -= 1
  return end
}

/**
 * The bare references on one line of a description: each starts the line's text or follows
 * whitespace, with or without a backslash before it.
 *
 * @param text - The file's text
 * @param content - The offset where the line's text starts
 * @param lineEnd - The offset after the line's last character
 * @param prefixes - The scopes guarded
 * @returns The references, in order
 */
function referencesOnLine(text: string, content: number, lineEnd: number, prefixes: readonly string[]): Reference[] {
  const found: Reference[] = []
  let index = content
  while (index < lineEnd) {
    const escaped = text[index] === '\\' && text[index + 1] === '@'
    const at = escaped ? index + 1 : index
    const bare = text[at] === '@' && (index === content || isBlank(text[index - 1] as string))
    const prefix = bare ? prefixes.find((candidate) => text.startsWith(candidate, at)) : undefined
    const end = prefix === undefined ? -1 : specifierEnd(text, at, prefix, lineEnd)
    if (end === -1) {
      index += 1
      continue
    }
    found.push({ start: index, end, specifier: text.slice(at, end) })
    index = end
  }
  return found
}

/**
 * The bare references in a JSDoc block's description: its lines up to the first genuine tag,
 * fenced code left out. A line opening with a guarded scope is a reference, not a tag.
 *
 * @param text - The file's text
 * @param comment - The JSDoc block
 * @param prefixes - The scopes guarded
 * @returns The references, in order
 */
function bareReferences(text: string, comment: SourceComment, prefixes: readonly string[]): Reference[] {
  const found: Reference[] = []
  const bodyEnd = comment.end - 2
  let fenced = false
  let lineStart = comment.start + 2
  while (lineStart < bodyEnd) {
    const breakAt = text.indexOf('\n', lineStart)
    const lineEnd = breakAt === -1 || breakAt >= bodyEnd ? bodyEnd : breakAt
    const content = contentStart(text, lineStart, lineEnd)
    const line = text.slice(content, lineEnd).replace(/\r$/, '')
    if (line.startsWith('```')) {
      fenced = !fenced
    } else if (!fenced) {
      if (line.startsWith('@') && !prefixes.some((prefix) => line.startsWith(prefix))) break
      found.push(...referencesOnLine(text, content, content + line.length, prefixes))
    }
    lineStart = lineEnd + 1
  }
  return found
}
