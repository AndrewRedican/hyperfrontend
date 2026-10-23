/**
 * The shape of a parsed JSON document as rules read it: objects, arrays, properties and literals,
 * each with the offsets of the text it covers. Declared here so that a rule's types need nothing
 * beyond this package.
 *
 * @module languages/json-tree
 */

/** A range of the parsed text: the offset of its first character and the offset after its last. */
export interface JsonSpan {
  /** The offset of the first character. */
  readonly start: number
  /** The offset after the last character. */
  readonly end: number
}

/** A string, number, boolean or null. */
export interface JsonLiteralNode extends JsonSpan {
  /** Which literal it is. */
  readonly kind: 'string' | 'number' | 'boolean' | 'null'
  /** The parsed value. */
  readonly value: string | number | boolean | null
  /** The text as written, quotes and escapes included. */
  readonly raw: string
}

/** One `"key": value` pair of an object. */
export interface JsonPropertyNode extends JsonSpan {
  /** Marks the node as a property. */
  readonly kind: 'property'
  /** The key, always a string literal. */
  readonly key: JsonLiteralNode
  /** The value. */
  readonly value: JsonNode
}

/** A brace-delimited list of properties. */
export interface JsonObjectNode extends JsonSpan {
  /** Marks the node as an object. */
  readonly kind: 'object'
  /** The properties in source order. */
  readonly properties: readonly JsonPropertyNode[]
}

/** A bracket-delimited list of values. */
export interface JsonArrayNode extends JsonSpan {
  /** Marks the node as an array. */
  readonly kind: 'array'
  /** The elements in source order. */
  readonly elements: readonly JsonNode[]
}

/** Any value. */
export type JsonNode = JsonObjectNode | JsonArrayNode | JsonLiteralNode
