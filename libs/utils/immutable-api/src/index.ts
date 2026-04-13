/**
 * \@hyperfrontend/immutable-api-utils
 *
 * Decorators and utilities for creating immutable, tamper-proof object APIs.
 *
 * This package provides:
 * - Safe copies of built-in JavaScript objects and methods
 * - Utilities for locking object properties
 * - Property descriptor utilities
 *
 * @module \@hyperfrontend/immutable-api-utils
 */

export { Array } from './built-in-copy/array'
export { Console } from './built-in-copy/console'
export { Date } from './built-in-copy/date'
export { Error } from './built-in-copy/error'
export { Function } from './built-in-copy/function'
export { JSON } from './built-in-copy/json'
export { Map } from './built-in-copy/map'
export { Messaging } from './built-in-copy/messaging'
export { SafeObject, SafeObject as Object } from './built-in-copy/object'
export { Promise } from './built-in-copy/promise'
export { Reflect } from './built-in-copy/reflect'
export { RegExp } from './built-in-copy/regexp'
export { Set } from './built-in-copy/set'
export { Symbol } from './built-in-copy/symbol'
export { Timers } from './built-in-copy/timers'
export { WeakMap } from './built-in-copy/weak-map'
export { WeakSet } from './built-in-copy/weak-set'

export * from './locked'
export * from './locked-props'
export * from './locked-prop-descriptors'
