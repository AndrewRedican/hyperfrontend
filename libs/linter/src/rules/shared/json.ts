/**
 * What JSON rules ask of a document: a property by name, the string values nested under a node,
 * the span of the whole document, and the indentation a property sits at, so a fix can write a
 * replacement that matches its surroundings.
 *
 * @module rules/shared/json
 */

import type { RuleFile } from '../../engine/rule'
import type { JsonDocument, JsonTreeNode } from '../../languages/json'
import type { JsonLiteralNode, JsonNode, JsonObjectNode, JsonPropertyNode, JsonSpan } from '../../languages/json-tree'

/** A string literal node. */
export interface JsonStringNode extends JsonLiteralNode {
  /** Marks the literal as a string. */
  readonly kind: 'string'
  /** The decoded text. */
  readonly value: string
}

/**
 * A property of an object by name.
 *
 * @param object - The node whose properties are searched
 * @param name - The key to look for
 * @returns The first property with that name, or null
 *
 * @example Look up a field of package.json
 * ```ts
 * // { "name": "@acme/ui", "files": ["dist"] }
 * propertyOf(manifest, 'files')?.value.kind // => 'array'
 * propertyOf(manifest, 'version') // => null
 * ```
 */
export function propertyOf(object: JsonObjectNode, name: string): JsonPropertyNode | null {
  return object.properties.find((property) => property.key.value === name) ?? null
}

/**
 * The root object of a document.
 *
 * @param node - The node a `document` listener received
 * @returns The root when it is an object, or null
 *
 * @example Start a rule from the document's root object
 * ```ts
 * document(node) {
 *   const manifest = rootObject(node)
 *   if (manifest === null) return // the document is an array or a literal
 * }
 * ```
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
 *
 * @example Narrow a property value to a string
 * ```ts
 * // { "name": "@acme/ui", "private": true }
 * isString(propertyOf(manifest, 'name').value) // => true
 * isString(propertyOf(manifest, 'private').value) // => false
 * ```
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
 *
 * @example Collect the strings of a nested value
 * ```ts
 * // "files": ["dist", { "glob": "src" }, 3]
 * stringsUnder(files.value).map((node) => node.value) // => ['dist', 'src']
 * ```
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
 *
 * @example Report a fact about the whole file
 * ```ts
 * context.report({ ...wholeDocument(context.file), message: 'Missing "license" field.' })
 * // wholeDocument(file) for an 86-character file => { start: 0, end: 86 }
 * ```
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
 *
 * @example Match a property's indentation in a fix
 * ```ts
 * const text = '{\n  "files": ["dist"]\n}'
 * indentationAt(text, 4) // => '  '
 * ```
 */
export function indentationAt(text: string, offset: number): string {
  let start = offset
  while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start -= 1
  return text.slice(start, offset)
}
