# typed-arrays

Locked, prototype-pollution-resistant copies of the global `ArrayBuffer`, `SharedArrayBuffer`, `DataView`, and `TypedArray` constructors.

Factory wrappers for `Uint8Array`, `Uint8ClampedArray`, `Uint16Array`, `Uint32Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array`, `BigUint64Array`, plus `ArrayBuffer`, `SharedArrayBuffer`, and `DataView`, are captured at module-load time and frozen into a tamper-proof namespace, so binary buffer construction stays trustworthy even if the globals are later patched. Effective only when imported before any untrusted code has had a chance to mutate the prototype chain.
