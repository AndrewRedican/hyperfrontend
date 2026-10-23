/**
 * JSON as a language: the positional tree `@hyperfrontend/json-utils` parses, under a `document`
 * node that holds the root value, with the comments the parser found.
 *
 * @module languages/json
 */

import type { LanguageAdapter, ParsedFile } from '../engine/languages'
import type { JsonNode, JsonPropertyNode } from './json-tree'
import { parseJsonSource } from '@hyperfrontend/json-utils'

/** The node that holds a document's root value. */
export interface JsonDocument {
  /** Marks the node as the document. */
  readonly kind: 'document'
  /** The root value. */
  readonly root: JsonNode
  /** The offset of the document's first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
}

/** Any node of a JSON tree. */
export type JsonTreeNode = JsonDocument | JsonNode | JsonPropertyNode

/**
 * Parses a JSON text.
 *
 * @param text - The document
 * @returns The tree under a document node, the comments, or the failure
 */
function parse(text: string): ParsedFile<JsonTreeNode> {
  const result = parseJsonSource(text)
  const comments = result.comments.map((span) => ({
    start: span.start,
    end: span.end,
    text: text.startsWith('//', span.start) ? text.slice(span.start + 2, span.end) : text.slice(span.start + 2, span.end - 2),
  }))
  if (result.root === null) return { tree: null, comments, error: result.error ?? { message: 'Unknown parse failure', offset: 0 } }
  return { tree: { kind: 'document', root: result.root, start: 0, end: text.length }, comments, error: null }
}

/**
 * The children of a JSON node.
 *
 * @param node - Any node of the tree
 * @returns Its children in source order; none for a literal
 */
function children(node: JsonTreeNode): readonly JsonTreeNode[] {
  switch (node.kind) {
    case 'document':
      return [node.root]
    case 'object':
      return node.properties
    case 'property':
      return [node.key, node.value]
    case 'array':
      return node.elements
    default:
      return []
  }
}

/** JSON as the engine reads it: the parser and the tree's children. */
export const jsonLanguage: LanguageAdapter<JsonTreeNode> = { name: 'json', parse, children }
