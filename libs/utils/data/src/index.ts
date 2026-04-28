/**
 * Data manipulation utilities for type detection, deep equality, traversal, and key/value operations.
 *
 * @module @hyperfrontend/data-utils
 */
export type { Location, Target, ICircularReference } from './circular-reference'
export type { DefaultValueOptions } from './get-value.model'
export type {
  Predicate,
  DataType,
  UnknownIterable,
  UnknownIterableKey,
  UnknownClass,
  RegisteredIterableClassEntry,
  IterableOperators,
  Config,
  ReferenceStack,
  DepthConfig,
  TraverseConfig,
  Condition,
  Callback,
  TraversalArgs,
  TraversalNonCircular,
  TraversalCircular,
  Traversal,
  TraversalCreator,
  Traverse,
} from './models'
export type {
  SelectiveCopyPredicate,
  DataPointOperation,
  SelectiveCopyOptions,
  DataPoint,
  ReferenceLoop,
  SelectiveCopyResult,
} from './selective-copy.model'
export { CircularReference } from './circular-reference'
export { containsKeys } from './contains-keys'
export { deregisterClassTypes } from './deregister-class-types'
export { deregisterIterableClass } from './deregister-iterable-class'
export { getDepth } from './get-depth'
export { getIterableOperators } from './get-iterable-operators'
export { getIterableTypes } from './get-iterable-types'
export { getKeysFromIterable } from './get-keys-from-iterable'
export { getType } from './get-type'
export { getUniqueKeys } from './get-unique-keys'
export { getValue } from './get-value'
export { hasCircularReference } from './has-circular-reference'
export { isIdentical } from './is-identical'
export { isIterable } from './is-iterable'
export { isIterableType } from './is-iterable-type'
export { isMarker } from './is-marker'
export { locateCircularReferenceRecursive, locateCircularReference } from './locate-circular-reference'
export { locateKey } from './locate-key'
export { locateText } from './locate-text'
export { marker } from './marker'
export { referenceStack } from './reference-stack'
export { registerClassTypes } from './register-class-types'
export { registerIterableClass } from './register-iterable-class'
export { removeKey } from './remove-key'
export { renameKey } from './rename-key'
export { replaceText } from './replace-text'
export { sameStructure } from './same-structure'
export { sameType } from './same-type'
export { selectiveCopyRecursive, selectiveCopyForCircularReferencesRecursive, selectiveCopy } from './selective-copy'
export { registeredClasses, registeredIterableClasses, setConfig, getConfig } from './shared/consts'
export { createTraversal, traverse } from './traverse'
