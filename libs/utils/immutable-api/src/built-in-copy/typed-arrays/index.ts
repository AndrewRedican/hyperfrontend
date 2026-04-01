/**
 * Safe copies of TypedArray and ArrayBuffer built-ins via factory functions.
 *
 * Provides safe references to Uint8Array, Int8Array, ArrayBuffer, DataView, etc.
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays
 */

const _ArrayBuffer = globalThis.ArrayBuffer
const _SharedArrayBuffer = globalThis.SharedArrayBuffer
const _DataView = globalThis.DataView
const _Uint8Array = globalThis.Uint8Array
const _Uint8ClampedArray = globalThis.Uint8ClampedArray
const _Uint16Array = globalThis.Uint16Array
const _Uint32Array = globalThis.Uint32Array
const _Int8Array = globalThis.Int8Array
const _Int16Array = globalThis.Int16Array
const _Int32Array = globalThis.Int32Array
const _Float32Array = globalThis.Float32Array
const _Float64Array = globalThis.Float64Array
const _BigInt64Array = globalThis.BigInt64Array
const _BigUint64Array = globalThis.BigUint64Array
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new ArrayBuffer using the captured ArrayBuffer constructor.
 * Use this instead of `new ArrayBuffer()`.
 *
 * @param byteLength - The size, in bytes, of the array buffer to create.
 * @returns A new ArrayBuffer instance.
 */
export const createArrayBuffer = (byteLength: number): ArrayBuffer => <ArrayBuffer>_Reflect.construct(_ArrayBuffer, [byteLength])

/**
 * (Safe copy) Returns true if arg is an ArrayBuffer or SharedArrayBuffer.
 */
export const isView = _ArrayBuffer.isView

/**
 * (Safe copy) Creates a new SharedArrayBuffer using the captured SharedArrayBuffer constructor.
 * Use this instead of `new SharedArrayBuffer()`.
 *
 * @param byteLength - The size, in bytes, of the shared array buffer to create.
 * @returns A new SharedArrayBuffer instance.
 */
export const createSharedArrayBuffer = (byteLength: number): SharedArrayBuffer =>
  <SharedArrayBuffer>_Reflect.construct(_SharedArrayBuffer, [byteLength])

/**
 * (Safe copy) Creates a new DataView using the captured DataView constructor.
 * Use this instead of `new DataView()`.
 *
 * @param buffer - The ArrayBuffer or SharedArrayBuffer to view.
 * @param byteOffset - Optional byte offset to start the view.
 * @param byteLength - Optional byte length of the view.
 * @returns A new DataView instance.
 */
export const createDataView = (buffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, byteLength?: number): DataView =>
  <DataView>_Reflect.construct(_DataView, [buffer, byteOffset, byteLength])

/**
 * (Safe copy) Creates a new Uint8Array using the captured Uint8Array constructor.
 * Use this instead of `new Uint8Array()`.
 *
 * Supports all standard Uint8Array constructor overloads:
 * - `createUint8Array(length)` - Creates array of given length
 * - `createUint8Array(arrayLike)` - Creates from array-like or iterable
 * - `createUint8Array(buffer, byteOffset?, length?)` - Creates view over buffer
 *
 * @param length - The length of the array to create.
 * @returns A new Uint8Array instance.
 */
export function createUint8Array(length: number): Uint8Array
export function createUint8Array(array: ArrayLike<number> | Iterable<number>): Uint8Array
export function createUint8Array(buffer: ArrayBufferLike, byteOffset?: number, length?: number): Uint8Array
export function createUint8Array(
  arg: number | ArrayLike<number> | Iterable<number> | ArrayBufferLike,
  byteOffset?: number,
  length?: number
): Uint8Array {
  if (typeof arg === 'number') {
    return <Uint8Array>_Reflect.construct(_Uint8Array, [arg])
  }
  if (arg instanceof _ArrayBuffer || arg instanceof _SharedArrayBuffer) {
    return <Uint8Array>_Reflect.construct(_Uint8Array, [arg, byteOffset, length])
  }
  return <Uint8Array>_Reflect.construct(_Uint8Array, [arg])
}

/**
 * (Safe copy) Creates a new Uint8Array from an array-like or iterable object.
 */
export const uint8ArrayFrom = <typeof Uint8Array.from>_Uint8Array.from.bind(_Uint8Array)

/**
 * (Safe copy) Creates a new Uint8Array from a variable number of arguments.
 */
export const uint8ArrayOf = <typeof Uint8Array.of>_Uint8Array.of.bind(_Uint8Array)

/**
 * (Safe copy) Creates a new Uint8ClampedArray using the captured Uint8ClampedArray constructor.
 * Use this instead of `new Uint8ClampedArray()`.
 *
 * @param length - Number of elements to allocate in the clamped array.
 * @returns A new Uint8ClampedArray instance.
 */
export const createUint8ClampedArray = (length: number): Uint8ClampedArray =>
  <Uint8ClampedArray>_Reflect.construct(_Uint8ClampedArray, [length])

/**
 * (Safe copy) Creates a new Uint8ClampedArray from an array-like or iterable object.
 */
export const uint8ClampedArrayFrom = <typeof Uint8ClampedArray.from>_Uint8ClampedArray.from.bind(_Uint8ClampedArray)

/**
 * (Safe copy) Creates a new Uint8ClampedArray from a variable number of arguments.
 */
export const uint8ClampedArrayOf = <typeof Uint8ClampedArray.of>_Uint8ClampedArray.of.bind(_Uint8ClampedArray)

/**
 * (Safe copy) Creates a new Uint16Array using the captured Uint16Array constructor.
 * Use this instead of `new Uint16Array()`.
 *
 * @param length - The length of the array.
 * @returns A new Uint16Array instance.
 */
export const createUint16Array = (length: number): Uint16Array => <Uint16Array>_Reflect.construct(_Uint16Array, [length])

/**
 * (Safe copy) Creates a new Uint16Array from an array-like or iterable object.
 */
export const uint16ArrayFrom = <typeof Uint16Array.from>_Uint16Array.from.bind(_Uint16Array)

/**
 * (Safe copy) Creates a new Uint16Array from a variable number of arguments.
 */
export const uint16ArrayOf = <typeof Uint16Array.of>_Uint16Array.of.bind(_Uint16Array)

/**
 * (Safe copy) Creates a new Uint32Array using the captured Uint32Array constructor.
 * Use this instead of `new Uint32Array()`.
 *
 * @param length - The length of the array.
 * @returns A new Uint32Array instance.
 */
export const createUint32Array = (length: number): Uint32Array => <Uint32Array>_Reflect.construct(_Uint32Array, [length])

/**
 * (Safe copy) Creates a new Uint32Array from an array-like or iterable object.
 */
export const uint32ArrayFrom = <typeof Uint32Array.from>_Uint32Array.from.bind(_Uint32Array)

/**
 * (Safe copy) Creates a new Uint32Array from a variable number of arguments.
 */
export const uint32ArrayOf = <typeof Uint32Array.of>_Uint32Array.of.bind(_Uint32Array)

/**
 * (Safe copy) Creates a new Int8Array using the captured Int8Array constructor.
 * Use this instead of `new Int8Array()`.
 *
 * @param length - The length of the array.
 * @returns A new Int8Array instance.
 */
export const createInt8Array = (length: number): Int8Array => <Int8Array>_Reflect.construct(_Int8Array, [length])

/**
 * (Safe copy) Creates a new Int8Array from an array-like or iterable object.
 */
export const int8ArrayFrom = <typeof Int8Array.from>_Int8Array.from.bind(_Int8Array)

/**
 * (Safe copy) Creates a new Int8Array from a variable number of arguments.
 */
export const int8ArrayOf = <typeof Int8Array.of>_Int8Array.of.bind(_Int8Array)

/**
 * (Safe copy) Creates a new Int16Array using the captured Int16Array constructor.
 * Use this instead of `new Int16Array()`.
 *
 * @param length - The length of the array.
 * @returns A new Int16Array instance.
 */
export const createInt16Array = (length: number): Int16Array => <Int16Array>_Reflect.construct(_Int16Array, [length])

/**
 * (Safe copy) Creates a new Int16Array from an array-like or iterable object.
 */
export const int16ArrayFrom = <typeof Int16Array.from>_Int16Array.from.bind(_Int16Array)

/**
 * (Safe copy) Creates a new Int16Array from a variable number of arguments.
 */
export const int16ArrayOf = <typeof Int16Array.of>_Int16Array.of.bind(_Int16Array)

/**
 * (Safe copy) Creates a new Int32Array using the captured Int32Array constructor.
 * Use this instead of `new Int32Array()`.
 *
 * @param length - The length of the array.
 * @returns A new Int32Array instance.
 */
export const createInt32Array = (length: number): Int32Array => <Int32Array>_Reflect.construct(_Int32Array, [length])

/**
 * (Safe copy) Creates a new Int32Array from an array-like or iterable object.
 */
export const int32ArrayFrom = <typeof Int32Array.from>_Int32Array.from.bind(_Int32Array)

/**
 * (Safe copy) Creates a new Int32Array from a variable number of arguments.
 */
export const int32ArrayOf = <typeof Int32Array.of>_Int32Array.of.bind(_Int32Array)

/**
 * (Safe copy) Creates a new Float32Array using the captured Float32Array constructor.
 * Use this instead of `new Float32Array()`.
 *
 * @param length - The length of the array.
 * @returns A new Float32Array instance.
 */
export const createFloat32Array = (length: number): Float32Array => <Float32Array>_Reflect.construct(_Float32Array, [length])

/**
 * (Safe copy) Creates a new Float32Array from an array-like or iterable object.
 */
export const float32ArrayFrom = <typeof Float32Array.from>_Float32Array.from.bind(_Float32Array)

/**
 * (Safe copy) Creates a new Float32Array from a variable number of arguments.
 */
export const float32ArrayOf = <typeof Float32Array.of>_Float32Array.of.bind(_Float32Array)

/**
 * (Safe copy) Creates a new Float64Array using the captured Float64Array constructor.
 * Use this instead of `new Float64Array()`.
 *
 * @param length - The length of the array.
 * @returns A new Float64Array instance.
 */
export const createFloat64Array = (length: number): Float64Array => <Float64Array>_Reflect.construct(_Float64Array, [length])

/**
 * (Safe copy) Creates a new Float64Array from an array-like or iterable object.
 */
export const float64ArrayFrom = <typeof Float64Array.from>_Float64Array.from.bind(_Float64Array)

/**
 * (Safe copy) Creates a new Float64Array from a variable number of arguments.
 */
export const float64ArrayOf = <typeof Float64Array.of>_Float64Array.of.bind(_Float64Array)

/**
 * (Safe copy) Creates a new BigInt64Array using the captured BigInt64Array constructor.
 * Use this instead of `new BigInt64Array()`.
 *
 * @param length - The length of the array.
 * @returns A new BigInt64Array instance.
 */
export const createBigInt64Array = (length: number): BigInt64Array => <BigInt64Array>_Reflect.construct(_BigInt64Array, [length])

/**
 * (Safe copy) Creates a new BigInt64Array from an array-like or iterable object.
 */
export const bigInt64ArrayFrom = <typeof BigInt64Array.from>_BigInt64Array.from.bind(_BigInt64Array)

/**
 * (Safe copy) Creates a new BigInt64Array from a variable number of arguments.
 */
export const bigInt64ArrayOf = <typeof BigInt64Array.of>_BigInt64Array.of.bind(_BigInt64Array)

/**
 * (Safe copy) Creates a new BigUint64Array using the captured BigUint64Array constructor.
 * Use this instead of `new BigUint64Array()`.
 *
 * @param length - The length of the array.
 * @returns A new BigUint64Array instance.
 */
export const createBigUint64Array = (length: number): BigUint64Array => <BigUint64Array>_Reflect.construct(_BigUint64Array, [length])

/**
 * (Safe copy) Creates a new BigUint64Array from an array-like or iterable object.
 */
export const bigUint64ArrayFrom = <typeof BigUint64Array.from>_BigUint64Array.from.bind(_BigUint64Array)

/**
 * (Safe copy) Creates a new BigUint64Array from a variable number of arguments.
 */
export const bigUint64ArrayOf = <typeof BigUint64Array.of>_BigUint64Array.of.bind(_BigUint64Array)

/**
 * (Safe copy) Namespace object containing all TypedArray utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const TypedArrays = _freeze(<const>{
  createArrayBuffer,
  isView,
  createSharedArrayBuffer,
  createDataView,
  createUint8Array,
  uint8ArrayFrom,
  uint8ArrayOf,
  createUint8ClampedArray,
  uint8ClampedArrayFrom,
  uint8ClampedArrayOf,
  createUint16Array,
  uint16ArrayFrom,
  uint16ArrayOf,
  createUint32Array,
  uint32ArrayFrom,
  uint32ArrayOf,
  createInt8Array,
  int8ArrayFrom,
  int8ArrayOf,
  createInt16Array,
  int16ArrayFrom,
  int16ArrayOf,
  createInt32Array,
  int32ArrayFrom,
  int32ArrayOf,
  createFloat32Array,
  float32ArrayFrom,
  float32ArrayOf,
  createFloat64Array,
  float64ArrayFrom,
  float64ArrayOf,
  createBigInt64Array,
  bigInt64ArrayFrom,
  bigInt64ArrayOf,
  createBigUint64Array,
  bigUint64ArrayFrom,
  bigUint64ArrayOf,
})
