/**
 * Safe Symbol factory and well-known symbols.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/symbol
 */
/* eslint-disable workspace/lib-require-jsdoc-example */

const _Symbol = globalThis.Symbol
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new Symbol with optional description.
 * Use this instead of `Symbol()`.
 *
 * @param description - Optional description for the symbol.
 * @returns A new Symbol.
 */
export const createSymbol = (description?: string | number): symbol => _Symbol(description)

/**
 * (Safe copy) Returns a Symbol object from the global symbol registry.
 */
export const symbolFor = _Symbol.for

/**
 * (Safe copy) Returns a key from the global symbol registry.
 */
export const symbolKeyFor = _Symbol.keyFor

/**
 * (Safe copy) A method that returns the default iterator for an object.
 */
export const symbolIterator = _Symbol.iterator

/**
 * (Safe copy) A method that returns the default async iterator for an object.
 */
export const symbolAsyncIterator = _Symbol.asyncIterator

/**
 * (Safe copy) A method that converts an object to a primitive value.
 */
export const symbolToStringTag = _Symbol.toStringTag

/**
 * (Safe copy) A method that determines if a constructor object recognizes an object as its instance.
 */
export const symbolHasInstance = _Symbol.hasInstance

/**
 * (Safe copy) A Boolean value indicating if an object should be flattened to its array elements.
 */
export const symbolIsConcatSpreadable = _Symbol.isConcatSpreadable

/**
 * (Safe copy) A method that matches against a string.
 */
export const symbolMatch = _Symbol.match

/**
 * (Safe copy) A method that returns an index within a string that matches the regular expression.
 */
export const symbolMatchAll = _Symbol.matchAll

/**
 * (Safe copy) A method that replaces matched substrings of a string.
 */
export const symbolReplace = _Symbol.replace

/**
 * (Safe copy) A method that returns the index within a string that matches the regular expression.
 */
export const symbolSearch = _Symbol.search

/**
 * (Safe copy) A method that splits a string at the indices that match a regular expression.
 */
export const symbolSplit = _Symbol.split

/**
 * (Safe copy) A function valued property that is the constructor function that is used to create derived objects.
 */
export const symbolSpecies = _Symbol.species

/**
 * (Safe copy) A method that converts an object to a primitive value.
 */
export const symbolToPrimitive = _Symbol.toPrimitive

/**
 * (Safe copy) An Object whose own property names are property names that are excluded from the with environment bindings.
 */
export const symbolUnscopables = _Symbol.unscopables

/**
 * (Safe copy) Namespace object containing Symbol utilities and well-known symbols.
 * Note: Importing this imports all symbols in this namespace (no tree-shaking).
 */
export const Symbol = _freeze({
  create: createSymbol,
  for: symbolFor,
  keyFor: symbolKeyFor,
  iterator: symbolIterator,
  asyncIterator: symbolAsyncIterator,
  toStringTag: symbolToStringTag,
  hasInstance: symbolHasInstance,
  isConcatSpreadable: symbolIsConcatSpreadable,
  match: symbolMatch,
  matchAll: symbolMatchAll,
  replace: symbolReplace,
  search: symbolSearch,
  split: symbolSplit,
  species: symbolSpecies,
  toPrimitive: symbolToPrimitive,
  unscopables: symbolUnscopables,
} as const)
