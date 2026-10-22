/**
 * Code as a language: TypeScript, TSX and JavaScript parsed by the code parser, with the
 * comments the directives are read from.
 *
 * @module languages/code
 */

import type { Node } from '../code/model.ts'
import type { LanguageSettings } from '../config/model.ts'
import type { LanguageAdapter, ParsedFile } from '../engine/languages.ts'
import { extname } from 'node:path'
import { childrenOf } from '../code/children.ts'
import { parseCode } from '../code/parse.ts'

/** The names of declaration files, ambient throughout. */
const DECLARATION_FILE = /\.d\.[cm]?ts$/

/**
 * The language of a code file, bound to its extension.
 *
 * @param path - The file's path, whose extension decides whether JSX is allowed
 * @returns The adapter
 */
export function codeLanguage(path: string): LanguageAdapter<Node> {
  const extension = extname(path).toLowerCase()
  return {
    name: 'code',
    /**
     * Parses a text as the file's dialect, in the module kind the language settings give.
     *
     * @param text - The text to parse
     * @param language - How the file is read
     * @returns The tree with its comments, or the error
     */
    parse(text: string, language: LanguageSettings): ParsedFile<Node> {
      const parsed = parseCode(text, extension, language.sourceType, DECLARATION_FILE.test(path.toLowerCase()))
      const comments = parsed.comments.map((comment) => ({ start: comment.start, end: comment.end, text: comment.text }))
      if (parsed.tree === null)
        return { tree: null, comments, error: { message: parsed.error?.message ?? '', offset: parsed.error?.offset ?? 0 } }
      return { tree: parsed.tree, comments, error: null }
    },
    children: childrenOf,
  }
}
