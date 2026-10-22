/**
 * JSON Schema Draft v4 utilities for validation, schema generation, and pattern safety checking,
 * and a JSON parser that keeps the position of every node.
 *
 * @module @hyperfrontend/json-utils
 */
export type { GenerateOptions } from './generate/to-json-schema'
export type {
  JsonArrayNode,
  JsonLiteralNode,
  JsonNode,
  JsonObjectNode,
  JsonParseError,
  JsonParseResult,
  JsonPropertyNode,
  JsonSpan,
} from './parse/parse-json'
export type { Schema, JsonType } from './types/schema'
export type { ValidationError, ValidationResult, ValidateOptions, PatternSafetyResult, PatternSafetyChecker } from './types/validation'
export { toJsonSchema } from './generate/to-json-schema'
export { getJsonType } from './generate/type-detection'
export { parseJsonSource } from './parse/parse-json'
export { createValidator } from './validate/create-validator'
export { isEqual } from './validate/utils/deep-equal'
export { checkPatternSafety } from './validate/utils/pattern-safety'
export { validate } from './validate/validate'
