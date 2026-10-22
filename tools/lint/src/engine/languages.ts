/**
 * The languages the linter reads, chosen by a file's extension. A language parses a text into a
 * tree the traversal can walk and reports the comments the directives are read from.
 *
 * @module engine/languages
 */

import type { SourceComment } from '../config/directives.ts'
import type { LanguageSettings } from '../config/model.ts'
import type { Language } from './rule.ts'
import type { TreeNode } from './traverse.ts'
import { codeLanguage } from '../languages/code.ts'
import { jsonLanguage } from '../languages/json.ts'
import { markdownLanguage } from '../languages/markdown.ts'
import { textLanguage } from '../languages/text.ts'

/** Why a text could not be parsed. */
export interface ParseFailure {
  /** What was wrong. */
  readonly message: string
  /** The offset where parsing stopped. */
  readonly offset: number
}

/** A text that parsed. */
export interface ParsedTree<Node extends TreeNode> {
  /** The tree. */
  readonly tree: Node
  /** The comments found, in source order. */
  readonly comments: readonly SourceComment[]
  /** No failure. */
  readonly error: null
}

/** A text that did not parse. */
export interface FailedParse {
  /** No tree. */
  readonly tree: null
  /** The comments found before parsing stopped. */
  readonly comments: readonly SourceComment[]
  /** Why parsing stopped. */
  readonly error: ParseFailure
}

/** What a language produced for a text. */
export type ParsedFile<Node extends TreeNode> = ParsedTree<Node> | FailedParse

/** One language. */
export interface LanguageAdapter<Node extends TreeNode> {
  /** The name rules declare. */
  readonly name: Language
  /** Parses a text. */
  readonly parse: (text: string, language: LanguageSettings) => ParsedFile<Node>
  /** The children of a node, in source order. */
  readonly children: (node: Node) => readonly Node[]
}

/**
 * The language of a file, by extension.
 *
 * @param path - The file's path
 * @returns The language, or null when the linter has none for the extension
 */
export function languageFor(path: string): LanguageAdapter<TreeNode> | null {
  // why: the previous linter matched extensions whatever their case.
  const lower = path.toLowerCase()
  if (lower.endsWith('.json') || lower.endsWith('.jsonc')) return jsonLanguage as LanguageAdapter<TreeNode>
  if (lower.endsWith('.md')) return markdownLanguage as LanguageAdapter<TreeNode>
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return textLanguage as LanguageAdapter<TreeNode>
  if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(lower)) return codeLanguage(path) as LanguageAdapter<TreeNode>
  return null
}
