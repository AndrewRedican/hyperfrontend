/**
 * Plain text as a language: one document node and no comments, for the files whose rules read
 * raw lines.
 *
 * @module languages/text
 */

import type { LanguageAdapter, ParsedFile } from '../engine/languages.ts'

/** The one node of a text document. */
export interface TextDocument {
  /** Marks the node as the document. */
  readonly kind: 'document'
  /** The offset of the first character. */
  readonly start: number
  /** The offset after the last character. */
  readonly end: number
}

/**
 * Wraps a text as a document.
 *
 * @param text - The file's content
 * @returns The document node, no comments
 */
function parse(text: string): ParsedFile<TextDocument> {
  return { tree: { kind: 'document', start: 0, end: text.length }, comments: [], error: null }
}

/**
 * The children of the document: none.
 *
 * @returns An empty list
 */
function children(): readonly TextDocument[] {
  return []
}

/** Plain text as the engine reads it. */
export const textLanguage: LanguageAdapter<TextDocument> = { name: 'text', parse, children }
