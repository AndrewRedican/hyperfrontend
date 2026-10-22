/**
 * What JSON rules ask of a document: a property by name, the string values nested under a node,
 * the span of the whole document, and the indentation a property sits at, so a fix can write a
 * replacement that matches its surroundings.
 *
 * @module rules/shared/json
 */

import type { JsonLiteralNode, JsonNode, JsonObjectNode, JsonPropertyNode, JsonSpan } from '@hyperfrontend/json-utils'
import type { RuleFile } from '../../engine/rule.ts'
import type { JsonDocument, JsonTreeNode } from '../../languages/json.ts'
import { posix } from 'node:path'

/** A string literal node. */
export interface JsonStringNode extends JsonLiteralNode {
  /** Marks the literal as a string. */
  readonly kind: 'string'
  /** The decoded text. */
  readonly value: string
}

/** The prefix of a path that names the package's own source directory. */
export const SOURCE_PREFIX = `.${posix.sep}src${posix.sep}`

/**
 * Whether an export path is relative, as `./x` and `../x` are, rather than a bare specifier.
 *
 * @param path - An export path as written in a manifest, which always uses `/`
 * @returns True for a relative path
 */
export function isRelativePath(path: string): boolean {
  return path.startsWith(`.${posix.sep}`) || path.startsWith(`..${posix.sep}`)
}

/**
 * A property of an object by name.
 *
 * @param object - The node whose properties are searched
 * @param name - The key to look for
 * @returns The first property with that name, or null
 */
export function propertyOf(object: JsonObjectNode, name: string): JsonPropertyNode | null {
  return object.properties.find((property) => property.key.value === name) ?? null
}

/**
 * The root object of a document.
 *
 * @param node - The node a `document` listener received
 * @returns The root when it is an object, or null
 */
export function rootObject(node: JsonTreeNode): JsonObjectNode | null {
  const { root } = node as JsonDocument
  return root.kind === 'object' ? root : null
}

/**
 * Whether a node is a string literal.
 *
 * @param node - Any value node
 * @returns True for a string
 */
export function isString(node: JsonNode): node is JsonStringNode {
  return node.kind === 'string'
}

/**
 * Every string literal under a node, in source order: the node itself, or the values nested in
 * its objects and arrays.
 *
 * @param node - The node to search
 * @returns The string nodes
 */
export function stringsUnder(node: JsonNode): JsonStringNode[] {
  if (isString(node)) return [node]
  if (node.kind === 'object') return node.properties.flatMap((property) => stringsUnder(property.value))
  if (node.kind === 'array') return node.elements.flatMap(stringsUnder)
  return []
}

/**
 * The span of the whole document, where a rule reports a fact about the file as a whole.
 *
 * @param file - The file being linted
 * @returns A problem's start and end
 */
export function wholeDocument(file: RuleFile): JsonSpan {
  return { start: 0, end: file.text.length }
}

/**
 * The whitespace that precedes a node on its line.
 *
 * @param text - The document
 * @param offset - The node's start
 * @returns The spaces and tabs between the line start and the node
 */
export function indentationAt(text: string, offset: number): string {
  let start = offset
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start -= 1
  return text.slice(start, offset)
}
