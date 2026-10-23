/**
 * The names every program sees as globals: the ECMAScript global object's own value
 * properties, read-only, with the positions the previous linter gave each.
 *
 * @module scope/globals
 */

import type { ReferenceKind } from './model'

/** A global's positions: both, type alone, or null for a name whose positions follow what a script declares. */
export type GlobalKind = ReferenceKind | null

/**
 * The value globals of the language, each with the positions the previous linter's library
 * tables left it: a name several tables declared kept the positions of the first, and a name the
 * tables never declared follows the declarations a script gives it.
 */
export const LANGUAGE_GLOBALS: Readonly<Record<string, GlobalKind>> = {
  AggregateError: 'both',
  Array: 'type',
  ArrayBuffer: 'type',
  AsyncDisposableStack: 'both',
  Atomics: 'type',
  BigInt: 'both',
  BigInt64Array: 'type',
  BigUint64Array: 'type',
  Boolean: 'both',
  DataView: 'type',
  Date: 'type',
  DisposableStack: 'both',
  Error: 'type',
  EvalError: 'both',
  FinalizationRegistry: 'both',
  Float16Array: 'both',
  Float32Array: 'type',
  Float64Array: 'type',
  Function: 'type',
  Infinity: null,
  Int16Array: 'type',
  Int32Array: 'type',
  Int8Array: 'type',
  Intl: 'both',
  Iterator: 'both',
  JSON: 'type',
  Map: 'type',
  Math: 'type',
  NaN: null,
  Number: 'type',
  Object: 'both',
  Promise: 'type',
  Proxy: null,
  RangeError: 'both',
  ReferenceError: 'both',
  Reflect: 'both',
  RegExp: 'type',
  Set: 'type',
  SharedArrayBuffer: 'type',
  String: 'type',
  SuppressedError: 'both',
  Symbol: 'type',
  SyntaxError: 'both',
  TypeError: 'both',
  URIError: 'both',
  Uint16Array: 'type',
  Uint32Array: 'type',
  Uint8Array: 'type',
  Uint8ClampedArray: 'type',
  WeakMap: 'type',
  WeakRef: 'both',
  WeakSet: 'type',
  decodeURI: null,
  decodeURIComponent: null,
  encodeURI: null,
  encodeURIComponent: null,
  escape: null,
  eval: null,
  globalThis: null,
  isFinite: null,
  isNaN: null,
  parseFloat: null,
  parseInt: null,
  undefined: null,
  unescape: null,
}
