# Security Hardening Plan: Prototype Pollution Defense

## Table of Contents

1. [Objective](#objective)
2. [Threat Model](#threat-model)
3. [API Design Philosophy](#api-design-philosophy)
4. [Built-in Methods Requiring Protection](#built-in-methods-requiring-protection)
5. [Codebase Audit Results](#codebase-audit-results)
6. [Implementation Plan](#implementation-plan)
7. [ESLint Rules](#eslint-rules)
8. [Migration Inventory](#migration-inventory)
9. [Acceptance Criteria](#acceptance-criteria)
10. [Security Considerations](#security-considerations)
11. [Bundler Configuration](#bundler-configuration)

---

## Objective

Harden the codebase against **prototype pollution attacks** by:

1. Capturing trusted copies of built-in static methods (`Object.*`, `Array.*`, `JSON.*`, `Reflect.*`) at module initialization time
2. Providing factory functions for Promise creation (since constructors cannot be safely captured)
3. Extending `@hyperfrontend/immutable-api-utils` to store and expose these safe method references
4. Exporting individual functions for tree-shaking via secondary entrypoints
5. Migrating production code to consume these protected methods instead of direct global access
6. Enforcing adoption through ESLint rules

---

## Threat Model

### Primary Concern

An attacker could replace or modify `Object.*` methods (or other globals) through:

- Dependency injection / supply chain compromise
- Malicious third-party scripts
- Runtime manipulation via browser extensions or injected code

Once compromised, all subsequent calls to these methods could be hijacked, enabling:

- Data exfiltration
- Privilege escalation
- Tampering with frozen/sealed objects

### Mitigation Strategy

Capture references to critical built-in methods at module initialization time, before external libraries load. While not infallible (an attacker who executes first wins), this significantly **narrows the attack window** and **reduces the scope of potential compromise**.

### When This Works

```
Timeline: [Our capture module loads] → [Third-party code loads] → [Attack attempted]
                     ↓                                                    ↓
              Methods captured                                    Attack fails
              (trusted copies)                                    (we use copies)
```

### When This Fails

```
Timeline: [Malicious code loads] → [Our capture module loads] → [Attack successful]
                   ↓                         ↓
            Methods poisoned           We capture poisoned methods
```

### Bootstrap Dependencies

The captured utility functions (e.g., `hasOwn`, `typeTag`) rely on `Function.prototype.call` for invocation. To minimize the bootstrap dependency chain:

1. **`Reflect.apply`** is captured and used internally where possible (avoids `.call()`)
2. **`Function.prototype.call`** is captured early, but if poisoned before our module loads, wrapper functions are compromised
3. This is an **inherent JavaScript limitation** — the invocation mechanism itself cannot be fully protected

---

## API Design Philosophy

### Tree-Shakeable Individual Exports (Required Pattern)

Each protected method is exported individually from secondary entrypoints, enabling bundlers to tree-shake unused methods:

```typescript
// Import only what you need — unused methods are tree-shaken
import { freeze, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isArray, from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise, promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createDate, dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
```

### Namespace Objects (Convenience)

For convenience, namespace objects are also available. **Note:** Importing a namespace imports all methods in that namespace (no tree-shaking for that namespace):

```typescript
// Convenience imports — mirror native API style
import { Object } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { JSON } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { Promise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { Map } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { Set } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { Date } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { Error } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { Symbol } from '@hyperfrontend/immutable-api-utils/built-in-copy/symbol'

// Usage mirrors native patterns
Object.freeze(myObject)
Array.isArray(value)
JSON.parse(text)
Promise.all([p1, p2])
Map.create([['key', 'value']]) // Instead of new Map()
Set.create([1, 2, 3]) // Instead of new Set()
Date.now()
Date.create() // Instead of new Date()
Error.create('message') // Instead of new Error()
Symbol.create('description') // Instead of Symbol()
Symbol.iterator // Well-known symbols work directly
```

**Note:** There is no main entrypoint. All consumers must use specific secondary entrypoints to ensure tree-shaking and ESLint enforcement.

### Package Structure

Following the workspace convention that library secondary entrypoints use `src/<feature>/index.ts` pattern with lowercase-kebab-style naming:

```
libs/utils/immutable-api/src/
├── built-in-copy/
│   ├── object/
│   │   └── index.ts            # Object.* methods (individual exports)
│   ├── array/
│   │   └── index.ts            # Array.* static methods (individual exports)
│   ├── json/
│   │   └── index.ts            # JSON.* methods (individual exports)
│   ├── promise/
│   │   └── index.ts            # Promise factory functions (individual exports)
│   ├── reflect/
│   │   └── index.ts            # Reflect.* methods (individual exports)
│   ├── function/
│   │   └── index.ts            # Function factory and utilities (individual exports)
│   ├── symbol/
│   │   └── index.ts            # Symbol factory and well-known symbols (individual exports)
│   ├── map/
│   │   └── index.ts            # Map factory (individual exports)
│   ├── set/
│   │   └── index.ts            # Set factory (individual exports)
│   ├── weak-map/
│   │   └── index.ts            # WeakMap factory (individual exports)
│   ├── weak-set/
│   │   └── index.ts            # WeakSet factory (individual exports)
│   ├── regexp/
│   │   └── index.ts            # RegExp factory (individual exports)
│   ├── date/
│   │   └── index.ts            # Date factory and static methods (individual exports)
│   └── error/
│       └── index.ts            # Error factory functions (individual exports)
├── locked/
│   └── index.ts                # Locked object utilities
├── locked-prop-descriptors/
│   └── index.ts                # Property descriptor utilities
└── locked-props/
    └── index.ts                # Property locking utilities
```

**Note:** There is no main entrypoint (`index.ts` at package root). All imports must use secondary entrypoints to encourage tree-shaking and explicit dependency declaration.

### TypeScript Considerations

Types are inferred from the captured references. JSDoc comments are copied with "(Safe copy)" indicator:

```typescript
// libs/utils/immutable-api/src/built-in-copy/object/index.ts

const _Object = globalThis.Object
const _Reflect = globalThis.Reflect
const _ObjectPrototype = _Object.prototype
const _hasOwnProperty = _ObjectPrototype.hasOwnProperty
const _toString = _ObjectPrototype.toString

/**
 * (Safe copy) Prevents modification of properties and values, and prevents addition of new properties.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
export const freeze = _Object.freeze

/**
 * (Safe copy) Creates an object with the specified prototype or null prototype.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/create
 */
export const create = _Object.create

// ... etc
```

### Promise Handling

**Problem:** `Object.assign(Promise, {...})` returns the global Promise — no protection. Constructors cannot be "copied."

**Solution:** Provide factory functions instead:

```typescript
// libs/utils/immutable-api/src/built-in-copy/promise/index.ts

const _Promise = globalThis.Promise
const _Reflect = globalThis.Reflect

/**
 * (Safe copy) Creates a new Promise using the captured Promise constructor.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise
 */
export const createPromise = <T>(
  executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => _Reflect.construct(_Promise, [executor]) as Promise<T>

/**
 * (Safe copy) Returns a Promise that resolves with the given value.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
 */
export const promiseResolve = _Promise.resolve.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that rejects with the given reason.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject
 */
export const promiseReject = _Promise.reject.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves when all promises resolve.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
 */
export const promiseAll = _Promise.all.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves/rejects with the first settled promise.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
 */
export const promiseRace = _Promise.race.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves when all promises settle.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
 */
export const promiseAllSettled = _Promise.allSettled.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves with the first fulfilled promise.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
 */
export const promiseAny = _Promise.any.bind(_Promise)
```

### Convenience Utilities

```typescript
// libs/utils/immutable-api/src/built-in-copy/object/index.ts (continued)

const _Reflect = globalThis.Reflect

/**
 * (Safe copy) Safe wrapper for Object.prototype.hasOwnProperty.call().
 * Uses Reflect.apply to avoid dependency on Function.prototype.call.
 */
export const hasOwn = (obj: object, key: PropertyKey): boolean => _Reflect.apply(_hasOwnProperty, obj, [key]) as boolean

/**
 * (Safe copy) Safe wrapper for Object.prototype.toString.call().
 * Returns the internal [[Class]] tag of a value.
 */
export const typeTag = (value: unknown): string => _Reflect.apply(_toString, value, []) as string

/**
 * (Safe copy) Determines whether an object has a property with the specified name.
 * ES2022 Object.hasOwn() equivalent using captured reference.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn
 */
export const objectHasOwn = _Object.hasOwn
```

---

## Built-in Methods Requiring Protection

### Scope Definition

This plan protects **static methods only**. Prototype methods (e.g., `Array.prototype.map`, `Promise.prototype.then`) are **explicitly excluded** because:

1. **Unusable in practice**: `myArray.map(fn)` always uses the global prototype, regardless of captured references
2. **Ergonomic failure**: Using `Array.prototype.map.call(myArray, fn)` defeats the "same API" design goal
3. **False sense of security**: Capturing prototype methods provides no practical protection

### In-Scope: Static Methods

| Method                             | Used | Notes                            |
| ---------------------------------- | :--: | -------------------------------- |
| `Object.freeze`                    |  ✓   | Immutable API surfaces           |
| `Object.create`                    |  ✓   | Null-prototype object creation   |
| `Object.keys`                      |  ✓   | Property key enumeration         |
| `Object.entries`                   |  ✓   | Key-value pair iteration         |
| `Object.values`                    |  ✓   | Value iteration                  |
| `Object.fromEntries`               |  ✓   | Object construction from entries |
| `Object.assign`                    |  ✓   | Object merging                   |
| `Object.defineProperty`            |  ✓   | Property descriptor definition   |
| `Object.defineProperties`          |  ✓   | Multiple property descriptors    |
| `Object.hasOwn`                    |      | ES2022 own property check        |
| `Object.setPrototypeOf`            |      | Prototype chain manipulation     |
| `Object.getPrototypeOf`            |      | Prototype chain inspection       |
| `Object.seal`                      |      | Prevent property addition        |
| `Object.isFrozen`                  |      | Frozen state check               |
| `Object.isSealed`                  |      | Sealed state check               |
| `Object.isExtensible`              |      | Extensibility check              |
| `Object.preventExtensions`         |      | Prevent extension                |
| `Object.getOwnPropertyDescriptor`  |      | Descriptor inspection            |
| `Object.getOwnPropertyNames`       |      | All own property names           |
| `Object.getOwnPropertySymbols`     |      | Symbol property enumeration      |
| `Array.isArray`                    |  ✓   | Array type checking              |
| `Array.from`                       |  ✓   | Array construction from iterable |
| `Array.of`                         |      | Array construction from args     |
| `JSON.parse`                       |  ✓   | Deserialization                  |
| `JSON.stringify`                   |  ✓   | Serialization                    |
| `Reflect.apply`                    |      | Function invocation (bootstrap)  |
| `Reflect.construct`                |      | Constructor invocation           |
| `Reflect.get`                      |      | Property access                  |
| `Reflect.set`                      |      | Property assignment              |
| `Reflect.has`                      |      | Property existence               |
| `Reflect.ownKeys`                  |      | All own keys                     |
| `Reflect.defineProperty`           |      | Property definition              |
| `Reflect.deleteProperty`           |      | Property deletion                |
| `Reflect.getOwnPropertyDescriptor` |      | Descriptor retrieval             |
| `Reflect.getPrototypeOf`           |      | Prototype retrieval              |
| `Reflect.setPrototypeOf`           |      | Prototype assignment             |
| `Reflect.isExtensible`             |      | Extensibility check              |
| `Reflect.preventExtensions`        |      | Prevent extension                |

### In-Scope: Prototype Methods (via utility wrappers)

| Utility Function | Wraps                             | Notes               |
| ---------------- | --------------------------------- | ------------------- |
| `hasOwn()`       | `Object.prototype.hasOwnProperty` | Safe property check |
| `typeTag()`      | `Object.prototype.toString`       | Type tag detection  |

### In-Scope: Promise Factory Functions

| Factory Function      | Equivalent To          | Notes                       |
| --------------------- | ---------------------- | --------------------------- |
| `createPromise()`     | `new Promise()`        | Safe constructor invocation |
| `promiseResolve()`    | `Promise.resolve()`    | Static resolution           |
| `promiseReject()`     | `Promise.reject()`     | Static rejection            |
| `promiseAll()`        | `Promise.all()`        | Parallel execution          |
| `promiseRace()`       | `Promise.race()`       | First-settled resolution    |
| `promiseAllSettled()` | `Promise.allSettled()` | All-settled resolution      |
| `promiseAny()`        | `Promise.any()`        | First-fulfilled resolution  |

### Out-of-Scope: Prototype Methods

These are **not protected** — normal usage (`array.map()`, `promise.then()`) always uses the global prototype:

- `Array.prototype.*` (map, filter, reduce, forEach, etc.)
- `Promise.prototype.*` (then, catch, finally)
- `Function.prototype.*` (call, apply, bind)

### In-Scope: Function

| Export              | Equivalent To        | Notes                                  |
| ------------------- | -------------------- | -------------------------------------- |
| `createFunction()`  | `new Function()`     | Safe constructor invocation            |
| `functionPrototype` | `Function.prototype` | Captured prototype reference           |
| `Function`          | `Function`           | Namespace with `create()`, `prototype` |

### In-Scope: Symbol

| Export                     | Equivalent To               | Notes                                                              |
| -------------------------- | --------------------------- | ------------------------------------------------------------------ |
| `createSymbol()`           | `Symbol()`                  | Safe symbol creation                                               |
| `symbolFor()`              | `Symbol.for()`              | Global symbol registry lookup                                      |
| `symbolKeyFor()`           | `Symbol.keyFor()`           | Reverse registry lookup                                            |
| `symbolIterator`           | `Symbol.iterator`           | Well-known symbol (captured)                                       |
| `symbolAsyncIterator`      | `Symbol.asyncIterator`      | Well-known symbol (captured)                                       |
| `symbolToStringTag`        | `Symbol.toStringTag`        | Well-known symbol (captured)                                       |
| `symbolHasInstance`        | `Symbol.hasInstance`        | Well-known symbol (captured)                                       |
| `symbolIsConcatSpreadable` | `Symbol.isConcatSpreadable` | Well-known symbol (captured)                                       |
| `symbolMatch`              | `Symbol.match`              | Well-known symbol (captured)                                       |
| `symbolReplace`            | `Symbol.replace`            | Well-known symbol (captured)                                       |
| `symbolSearch`             | `Symbol.search`             | Well-known symbol (captured)                                       |
| `symbolSplit`              | `Symbol.split`              | Well-known symbol (captured)                                       |
| `symbolSpecies`            | `Symbol.species`            | Well-known symbol (captured)                                       |
| `symbolToPrimitive`        | `Symbol.toPrimitive`        | Well-known symbol (captured)                                       |
| `symbolUnscopables`        | `Symbol.unscopables`        | Well-known symbol (captured)                                       |
| `Symbol`                   | `Symbol`                    | Namespace with `create()`, `for()`, `keyFor()`, well-known symbols |

### In-Scope: Map / Set / WeakMap / WeakSet

| Export            | Equivalent To   | Notes                       |
| ----------------- | --------------- | --------------------------- |
| `createMap()`     | `new Map()`     | Safe constructor invocation |
| `createSet()`     | `new Set()`     | Safe constructor invocation |
| `createWeakMap()` | `new WeakMap()` | Safe constructor invocation |
| `createWeakSet()` | `new WeakSet()` | Safe constructor invocation |
| `Map`             | `Map`           | Namespace with `create()`   |
| `Set`             | `Set`           | Namespace with `create()`   |
| `WeakMap`         | `WeakMap`       | Namespace with `create()`   |
| `WeakSet`         | `WeakSet`       | Namespace with `create()`   |

### In-Scope: RegExp

| Export           | Equivalent To  | Notes                       |
| ---------------- | -------------- | --------------------------- |
| `createRegExp()` | `new RegExp()` | Safe constructor invocation |
| `RegExp`         | `RegExp`       | Namespace with `create()`   |

### In-Scope: Date

| Export         | Equivalent To  | Notes                                                  |
| -------------- | -------------- | ------------------------------------------------------ |
| `createDate()` | `new Date()`   | Safe constructor invocation                            |
| `dateNow()`    | `Date.now()`   | Static method (captured)                               |
| `dateParse()`  | `Date.parse()` | Static method (captured)                               |
| `dateUTC()`    | `Date.UTC()`   | Static method (captured)                               |
| `Date`         | `Date`         | Namespace with `create()`, `now()`, `parse()`, `UTC()` |

### In-Scope: Error

| Export                   | Equivalent To          | Notes                          |
| ------------------------ | ---------------------- | ------------------------------ |
| `createError()`          | `new Error()`          | Safe constructor invocation    |
| `createTypeError()`      | `new TypeError()`      | Safe constructor invocation    |
| `createRangeError()`     | `new RangeError()`     | Safe constructor invocation    |
| `createReferenceError()` | `new ReferenceError()` | Safe constructor invocation    |
| `createSyntaxError()`    | `new SyntaxError()`    | Safe constructor invocation    |
| `createURIError()`       | `new URIError()`       | Safe constructor invocation    |
| `createEvalError()`      | `new EvalError()`      | Safe constructor invocation    |
| `createAggregateError()` | `new AggregateError()` | Safe constructor invocation    |
| `Error`                  | `Error`                | Namespace with factory methods |

### Out-of-Scope: Instance Methods

Instance methods cannot be practically protected. Normal usage always uses the global prototype:

- `Map.prototype.*` (get, set, has, delete, etc.)
- `Set.prototype.*` (add, has, delete, etc.)
- `WeakMap.prototype.*` (get, set, has, delete)
- `WeakSet.prototype.*` (add, has, delete)
- `Date.prototype.*` (getTime, getFullYear, etc.)

---

## Codebase Audit Results

### Production Files Requiring Migration

Files marked with (P) are production files. Test files, setup files, and build tooling are excluded.

#### `libs/cryptography/` (P)

| File                                                                  | Methods Used                     | Migration Import                       |
| --------------------------------------------------------------------- | -------------------------------- | -------------------------------------- |
| `src/lib/encryption-config.ts`                                        | `Object.freeze`                  | `{ freeze } from '.../object'`         |
| `src/lib/get-time-based-passwords/create-get-time-based-passwords.ts` | `Object.freeze`                  | `{ freeze } from '.../object'`         |
| `src/lib/create-vault/create-value-creator.ts`                        | `Object.create`, `Object.freeze` | `{ create, freeze } from '.../object'` |
| `src/lib/create-hash/browser.ts`                                      | `Array.from`                     | `{ from } from '.../array'`            |

#### `libs/logging/` (P)

| File                             | Methods Used    | Migration Import               |
| -------------------------------- | --------------- | ------------------------------ |
| `src/create-log-level-config.ts` | `Object.freeze` | `{ freeze } from '.../object'` |
| `src/create-logger.ts`           | `Object.freeze` | `{ freeze } from '.../object'` |

#### `libs/utils/list/` (P)

| File                      | Methods Used                  | Migration Import            |
| ------------------------- | ----------------------------- | --------------------------- |
| `src/create-fifo-list.ts` | `Object.freeze`, `Array.from` | `{ freeze }`, `{ from }`    |
| `src/create-lifo-list.ts` | `Object.freeze`, `Array.from` | `{ freeze }`, `{ from }`    |
| `src/unique-strings.ts`   | `Array.from`                  | `{ from } from '.../array'` |

#### `libs/utils/data/` (P)

| File                   | Methods Used                     | Migration Import             |
| ---------------------- | -------------------------------- | ---------------------------- |
| `src/shared/consts.ts` | `Object.keys`                    | `{ keys } from '.../object'` |
| `src/traverse.ts`      | `Object.freeze`, `Array.isArray` | `{ freeze }`, `{ isArray }`  |

#### `libs/utils/time/` (P)

| File                  | Methods Used    | Migration Import                       |
| --------------------- | --------------- | -------------------------------------- |
| `src/create-timer.ts` | `Object.freeze` | `{ freeze } from '.../object'`         |
| `src/create-clock.ts` | `Object.freeze` | `{ freeze } from '.../object'`         |
| `src/sleep.ts`        | `new Promise`   | `{ createPromise } from '.../promise'` |

#### `libs/utils/immutable-api/` (P) — **SELF-MIGRATION REQUIRED**

| File                        | Methods Used                                                    | Migration Import                                            |
| --------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/locked/index.ts`       | `Object.prototype.hasOwnProperty.call`, `Object.defineProperty` | `{ hasOwn, defineProperty } from '../built-in-copy/object'` |
| `src/locked-props/index.ts` | `Object.defineProperties`                                       | `{ defineProperties } from '../built-in-copy/object'`       |

#### `libs/utils/ui/` (P)

| File                              | Methods Used     | Migration Import                       |
| --------------------------------- | ---------------- | -------------------------------------- |
| `src/lib/css-object-to-string.ts` | `Object.entries` | `{ entries } from '.../object'`        |
| `src/lib/css-rules.ts`            | `Object.entries` | `{ entries } from '.../object'`        |
| `src/lib/create-element.ts`       | `Object.assign`  | `{ assign } from '.../object'`         |
| `src/lib/pause.ts`                | `new Promise`    | `{ createPromise } from '.../promise'` |
| `src/lib/setup-audio.ts`          | `new Promise`    | `{ createPromise } from '.../promise'` |

#### `libs/utils/json/` (P)

| File                                          | Methods Used                                                            | Migration Import                              |
| --------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `src/generate/to-json-schema.ts`              | `Object.keys`                                                           | `{ keys } from '.../object'`                  |
| `src/generate/merge-schemas.ts`               | `Object.keys`, `Object.entries`                                         | `{ keys, entries } from '.../object'`         |
| `src/validate/utils/deep-equal.ts`            | `Object.keys`, `Object.prototype.hasOwnProperty.call`                   | `{ keys, hasOwn } from '.../object'`          |
| `src/validate/keywords/dependencies.ts`       | `Object.entries`, `Object.prototype.hasOwnProperty.call`                | `{ entries, hasOwn } from '.../object'`       |
| `src/validate/keywords/pattern-properties.ts` | `Object.entries`, `Object.keys`                                         | `{ entries, keys } from '.../object'`         |
| `src/validate/keywords/object-bounds.ts`      | `Object.keys`                                                           | `{ keys } from '.../object'`                  |
| `src/validate/keywords/properties.ts`         | `Object.entries`, `Object.keys`, `Object.prototype.hasOwnProperty.call` | `{ entries, keys, hasOwn } from '.../object'` |
| `src/validate/keywords/composition.ts`        | `Object.defineProperty`                                                 | `{ defineProperty } from '.../object'`        |
| `src/validate/context.ts`                     | `Object.entries`                                                        | `{ entries } from '.../object'`               |

#### `libs/network-protocol/` (P)

| File                                                                       | Methods Used                     | Migration Import                      |
| -------------------------------------------------------------------------- | -------------------------------- | ------------------------------------- |
| `src/lib/channel/validations/get-first-invalid-protocol-property.ts`       | `Object.keys`, `Object.entries`  | `{ keys, entries } from '.../object'` |
| `src/lib/channel/creators/create-channel.ts`                               | `Object.freeze` (×3)             | `{ freeze } from '.../object'`        |
| `src/lib/channel/creators/create-channel-store.ts`                         | `Object.freeze` (×3)             | `{ freeze } from '.../object'`        |
| `src/lib/protocol/v2/creators/create-static-key-protocol-factory.ts`       | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/protocol/v1/creators/create-protocol-factory.ts`                  | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/protocol/validations/is-valid-protocol.ts`                        | `Object.keys`                    | `{ keys } from '.../object'`          |
| `src/lib/protocol/creators/create-provider-protocol-store.ts`              | `Object.freeze` (×3)             | `{ freeze } from '.../object'`        |
| `src/lib/receiver/creators/create-receiver-factory.ts`                     | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/data/creators/create-data-factory.ts`                             | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/data/validations/is-valid-unserialized-data.ts`                   | `Object.prototype.toString.call` | `{ typeTag } from '.../object'`       |
| `src/lib/routing/creators/create-routed-obfuscated-packet.ts`              | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/routing/creators/create-routed-unencrypted-packet.ts`             | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/queue/utils/get-validation-error.ts`                              | `Object.entries`                 | `{ entries } from '.../object'`       |
| `src/lib/queue/creators/create-queue.ts`                                   | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/topic/creators/create-topic-store.ts`                             | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/sender/creators/create-sender-factory.ts`                         | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/encryption/create-first-message-handler.ts`       | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/encryption/psk-handshake-encryption-key.ts`       | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/encryption/static-encryption-key.ts`              | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/encryption/create-decrypter.ts`                   | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/encryption/create-encrypter.ts`                   | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/encryption/dynamic-encryption-key.ts`             | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/obfuscation/dynamic-obfuscation-key.ts`           | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/obfuscation/time-interval-obfuscation-factory.ts` | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/security/obfuscation/create-deobfuscator.ts`               | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/creators/create-unencrypted-packet.ts`                     | `Object.freeze`                  | `{ freeze } from '.../object'`        |
| `src/lib/packet/creators/create-serialized-encrypted-packet-creator.ts`    | `Object.freeze`                  | `{ freeze } from '.../object'`        |

---

## Implementation Plan

### Phase 1: Create Safe Built-ins Module Structure

**Location:** `libs/utils/immutable-api/src/built-in-copy/`

Create a directory structure with individual folders for each builtin category. Each folder contains an `index.ts` that captures references at load time and exports individual functions for tree-shaking. Use lowercase-kebab-style naming.

#### `libs/utils/immutable-api/src/built-in-copy/object/index.ts`

````typescript
/**
 * @fileoverview Safe Object built-in method references captured at module load time.
 * @module built-in-copy/object
 */

const _Object = globalThis.Object
const _Reflect = globalThis.Reflect
const _ObjectPrototype = _Object.prototype
const _hasOwnProperty = _ObjectPrototype.hasOwnProperty
const _toString = _ObjectPrototype.toString

// =============================================================================
// Static Methods
// =============================================================================

/**
 * (Safe copy) Prevents modification of properties and values, and prevents addition of new properties.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
export const freeze = _Object.freeze

/**
 * (Safe copy) Creates an object with the specified prototype or null prototype.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/create
 */
export const create = _Object.create

/**
 * (Safe copy) Returns the names of the enumerable string properties of an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
 */
export const keys = _Object.keys

/**
 * (Safe copy) Returns an array of key/value pairs of the enumerable properties of an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
 */
export const entries = _Object.entries

/**
 * (Safe copy) Returns an array of values of the enumerable properties of an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/values
 */
export const values = _Object.values

/**
 * (Safe copy) Returns an object from an iterable of key-value pairs.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
 */
export const fromEntries = _Object.fromEntries

/**
 * (Safe copy) Copies enumerable own properties from source objects to a target object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
 */
export const assign = _Object.assign

/**
 * (Safe copy) Adds or modifies a property on an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
 */
export const defineProperty = _Object.defineProperty

/**
 * (Safe copy) Adds or modifies multiple properties on an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties
 */
export const defineProperties = _Object.defineProperties

/**
 * (Safe copy) Sets the prototype of a specified object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf
 */
export const setPrototypeOf = _Object.setPrototypeOf

/**
 * (Safe copy) Returns the prototype of an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf
 */
export const getPrototypeOf = _Object.getPrototypeOf

/**
 * (Safe copy) Seals an object, preventing new properties and marking existing properties as non-configurable.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/seal
 */
export const seal = _Object.seal

/**
 * (Safe copy) Determines whether an object is frozen.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/isFrozen
 */
export const isFrozen = _Object.isFrozen

/**
 * (Safe copy) Determines whether an object is sealed.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/isSealed
 */
export const isSealed = _Object.isSealed

/**
 * (Safe copy) Determines whether an object is extensible.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/isExtensible
 */
export const isExtensible = _Object.isExtensible

/**
 * (Safe copy) Prevents new properties from being added to an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/preventExtensions
 */
export const preventExtensions = _Object.preventExtensions

/**
 * (Safe copy) Returns a property descriptor for an own property.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor
 */
export const getOwnPropertyDescriptor = _Object.getOwnPropertyDescriptor

/**
 * (Safe copy) Returns an array of all own property names.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames
 */
export const getOwnPropertyNames = _Object.getOwnPropertyNames

/**
 * (Safe copy) Returns an array of all own symbol properties.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols
 */
export const getOwnPropertySymbols = _Object.getOwnPropertySymbols

/**
 * (Safe copy) Determines whether an object has a property with the specified name as its own property.
 * ES2022 Object.hasOwn() implementation using captured reference.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn
 */
export const objectHasOwn = _Object.hasOwn

// =============================================================================
// Convenience Utilities (wrapping prototype methods)
// =============================================================================

/**
 * (Safe copy) Safe wrapper for Object.prototype.hasOwnProperty.call().
 * Uses Reflect.apply to minimize bootstrap dependencies.
 *
 * @param obj - The object to check
 * @param key - The property key to check
 * @returns True if the object has the specified property as its own
 *
 * @example
 * ```typescript
 * import { hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
 *
 * hasOwn({ a: 1 }, 'a') // true
 * hasOwn({ a: 1 }, 'b') // false
 * hasOwn({ a: 1 }, 'toString') // false (inherited)
 * ```
 */
export const hasOwn = (obj: object, key: PropertyKey): boolean => _Reflect.apply(_hasOwnProperty, obj, [key]) as boolean

/**
 * (Safe copy) Safe wrapper for Object.prototype.toString.call().
 * Returns the internal [[Class]] tag of a value.
 * Uses Reflect.apply to minimize bootstrap dependencies.
 *
 * @param value - The value to get the type tag for
 * @returns The type tag string (e.g., "[object Array]", "[object Object]")
 *
 * @example
 * ```typescript
 * import { typeTag } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
 *
 * typeTag([]) // "[object Array]"
 * typeTag({}) // "[object Object]"
 * typeTag(null) // "[object Null]"
 * typeTag(new Map()) // "[object Map]"
 * ```
 */
export const typeTag = (value: unknown): string => _Reflect.apply(_toString, value, []) as string

// =============================================================================
// Namespace Export (for convenience, but defeats tree-shaking)
// =============================================================================

/**
 * (Safe copy) Safe built-in Object methods as a namespace.
 * WARNING: Importing this imports ALL methods. For tree-shaking, import individual functions.
 */
export const Object = _Object.freeze({
  freeze,
  create,
  keys,
  entries,
  values,
  fromEntries,
  assign,
  defineProperty,
  defineProperties,
  setPrototypeOf,
  getPrototypeOf,
  seal,
  isFrozen,
  isSealed,
  isExtensible,
  preventExtensions,
  getOwnPropertyDescriptor,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  hasOwn: objectHasOwn,
})
````

#### `libs/utils/immutable-api/src/built-in-copy/array/index.ts`

```typescript
/**
 * @fileoverview Safe Array built-in method references captured at module load time.
 * @module built-in-copy/array
 */

const _Array = globalThis.Array
const _Object = globalThis.Object

/**
 * (Safe copy) Determines whether the passed value is an Array.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
 */
export const isArray = _Array.isArray

/**
 * (Safe copy) Creates a new Array instance from an iterable or array-like object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/from
 */
export const from = _Array.from

/**
 * (Safe copy) Creates a new Array instance with a variable number of arguments.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/of
 */
export const of = _Array.of

/**
 * (Safe copy) Safe built-in Array static methods as a namespace.
 * WARNING: Importing this imports ALL methods. For tree-shaking, import individual functions.
 */
export const Array = _Object.freeze({
  isArray,
  from,
  of,
})
```

#### `libs/utils/immutable-api/src/built-in-copy/json/index.ts`

```typescript
/**
 * @fileoverview Safe JSON built-in method references captured at module load time.
 * @module built-in-copy/json
 */

const _JSON = globalThis.JSON
const _Object = globalThis.Object

/**
 * (Safe copy) Parses a JSON string, constructing the JavaScript value or object described by the string.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
 */
export const parse = _JSON.parse

/**
 * (Safe copy) Converts a JavaScript value to a JSON string.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
 */
export const stringify = _JSON.stringify

/**
 * (Safe copy) Safe built-in JSON methods as a namespace.
 * WARNING: Importing this imports ALL methods. For tree-shaking, import individual functions.
 */
export const JSON = _Object.freeze({
  parse,
  stringify,
})
```

#### `libs/utils/immutable-api/src/built-in-copy/promise/index.ts`

````typescript
/**
 * @fileoverview Safe Promise factory functions using captured references.
 *
 * NOTE: Constructors cannot be safely "captured" — Object.assign(Promise, {...})
 * returns the original Promise, providing no protection. This module provides
 * factory functions as an alternative.
 *
 * @module built-in-copy/promise
 */

const _Promise = globalThis.Promise
const _Reflect = globalThis.Reflect
const _Object = globalThis.Object

/**
 * (Safe copy) Creates a new Promise using the captured Promise constructor via Reflect.construct.
 * Use this instead of `new Promise(...)` for protection against constructor pollution.
 *
 * @param executor - A callback used to initialize the promise
 * @returns A new Promise instance
 *
 * @example
 * ```typescript
 * import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
 *
 * const result = await createPromise<string>((resolve, reject) => {
 *   setTimeout(() => resolve('done'), 100)
 * })
 * ```
 *
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise
 */
export const createPromise = <T>(
  executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => _Reflect.construct(_Promise, [executor]) as Promise<T>

/**
 * (Safe copy) Returns a Promise that resolves with the given value.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
 */
export const promiseResolve: typeof Promise.resolve = _Promise.resolve.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that rejects with the given reason.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject
 */
export const promiseReject: typeof Promise.reject = _Promise.reject.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves when all input promises resolve.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
 */
export const promiseAll: typeof Promise.all = _Promise.all.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves/rejects with the first settled promise.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
 */
export const promiseRace: typeof Promise.race = _Promise.race.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves when all input promises settle.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
 */
export const promiseAllSettled: typeof Promise.allSettled = _Promise.allSettled.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves with the first fulfilled promise.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
 */
export const promiseAny: typeof Promise.any = _Promise.any.bind(_Promise)

/**
 * (Safe copy) Safe Promise factory functions as a namespace.
 * WARNING: Importing this imports ALL functions. For tree-shaking, import individual functions.
 *
 * NOTE: This is NOT a drop-in replacement for the global Promise. Use factory functions:
 * - `Promise.create()` instead of `new Promise()`
 * - `Promise.resolve()`, `Promise.all()`, etc. work as expected
 */
export const Promise = _Object.freeze({
  create: createPromise,
  resolve: promiseResolve,
  reject: promiseReject,
  all: promiseAll,
  race: promiseRace,
  allSettled: promiseAllSettled,
  any: promiseAny,
})
````

#### `libs/utils/immutable-api/src/built-in-copy/reflect/index.ts`

```typescript
/**
 * @fileoverview Safe Reflect built-in method references captured at module load time.
 * @module built-in-copy/reflect
 */

const _Reflect = globalThis.Reflect
const _Object = globalThis.Object

/**
 * (Safe copy) Calls a target function with arguments.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/apply
 */
export const apply = _Reflect.apply

/**
 * (Safe copy) Invokes a constructor with arguments.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct
 */
export const construct = _Reflect.construct

/**
 * (Safe copy) Gets the value of a property on an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/get
 */
export const get = _Reflect.get

/**
 * (Safe copy) Sets the value of a property on an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/set
 */
export const set = _Reflect.set

/**
 * (Safe copy) Checks if a property exists on an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/has
 */
export const has = _Reflect.has

/**
 * (Safe copy) Defines a property on an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/defineProperty
 */
export const defineProperty = _Reflect.defineProperty

/**
 * (Safe copy) Deletes a property from an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/deleteProperty
 */
export const deleteProperty = _Reflect.deleteProperty

/**
 * (Safe copy) Returns a property descriptor for an own property.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/getOwnPropertyDescriptor
 */
export const getOwnPropertyDescriptor = _Reflect.getOwnPropertyDescriptor

/**
 * (Safe copy) Returns all own property keys.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys
 */
export const ownKeys = _Reflect.ownKeys

/**
 * (Safe copy) Returns the prototype of an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/getPrototypeOf
 */
export const getPrototypeOf = _Reflect.getPrototypeOf

/**
 * (Safe copy) Sets the prototype of an object.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/setPrototypeOf
 */
export const setPrototypeOf = _Reflect.setPrototypeOf

/**
 * (Safe copy) Checks if an object is extensible.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/isExtensible
 */
export const isExtensible = _Reflect.isExtensible

/**
 * (Safe copy) Prevents an object from being extended.
 * @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Reflect/preventExtensions
 */
export const preventExtensions = _Reflect.preventExtensions

/**
 * (Safe copy) Safe built-in Reflect methods as a namespace.
 * WARNING: Importing this imports ALL methods. For tree-shaking, import individual functions.
 */
export const Reflect = _Object.freeze({
  apply,
  construct,
  get,
  set,
  has,
  defineProperty,
  deleteProperty,
  getOwnPropertyDescriptor,
  ownKeys,
  getPrototypeOf,
  setPrototypeOf,
  isExtensible,
  preventExtensions,
})
```

#### Additional Built-in Copy Modules

The following modules follow the same pattern (capture at load time, export individual functions):

- `libs/utils/immutable-api/src/built-in-copy/function/index.ts` — Function factory and prototype
- `libs/utils/immutable-api/src/built-in-copy/symbol/index.ts` — Symbol factory and well-known symbols
- `libs/utils/immutable-api/src/built-in-copy/map/index.ts` — Map factory
- `libs/utils/immutable-api/src/built-in-copy/set/index.ts` — Set factory
- `libs/utils/immutable-api/src/built-in-copy/weak-map/index.ts` — WeakMap factory
- `libs/utils/immutable-api/src/built-in-copy/weak-set/index.ts` — WeakSet factory
- `libs/utils/immutable-api/src/built-in-copy/regexp/index.ts` — RegExp factory
- `libs/utils/immutable-api/src/built-in-copy/date/index.ts` — Date factory and static methods
- `libs/utils/immutable-api/src/built-in-copy/error/index.ts` — Error factory functions for all Error types

### Phase 2: Configure Secondary Entrypoints

Update `libs/utils/immutable-api/package.json` to expose secondary entrypoints for tree-shaking.

**Note:** There is no main entrypoint (`.`) — all consumers must use specific secondary entrypoints.

```json
{
  "name": "@hyperfrontend/immutable-api-utils",
  "exports": {
    "./built-in-copy/object": {
      "import": "./src/built-in-copy/object/index.ts",
      "types": "./src/built-in-copy/object/index.ts"
    },
    "./built-in-copy/array": {
      "import": "./src/built-in-copy/array/index.ts",
      "types": "./src/built-in-copy/array/index.ts"
    },
    "./built-in-copy/json": {
      "import": "./src/built-in-copy/json/index.ts",
      "types": "./src/built-in-copy/json/index.ts"
    },
    "./built-in-copy/promise": {
      "import": "./src/built-in-copy/promise/index.ts",
      "types": "./src/built-in-copy/promise/index.ts"
    },
    "./built-in-copy/reflect": {
      "import": "./src/built-in-copy/reflect/index.ts",
      "types": "./src/built-in-copy/reflect/index.ts"
    },
    "./built-in-copy/function": {
      "import": "./src/built-in-copy/function/index.ts",
      "types": "./src/built-in-copy/function/index.ts"
    },
    "./built-in-copy/symbol": {
      "import": "./src/built-in-copy/symbol/index.ts",
      "types": "./src/built-in-copy/symbol/index.ts"
    },
    "./built-in-copy/map": {
      "import": "./src/built-in-copy/map/index.ts",
      "types": "./src/built-in-copy/map/index.ts"
    },
    "./built-in-copy/set": {
      "import": "./src/built-in-copy/set/index.ts",
      "types": "./src/built-in-copy/set/index.ts"
    },
    "./built-in-copy/weak-map": {
      "import": "./src/built-in-copy/weak-map/index.ts",
      "types": "./src/built-in-copy/weak-map/index.ts"
    },
    "./built-in-copy/weak-set": {
      "import": "./src/built-in-copy/weak-set/index.ts",
      "types": "./src/built-in-copy/weak-set/index.ts"
    },
    "./built-in-copy/regexp": {
      "import": "./src/built-in-copy/regexp/index.ts",
      "types": "./src/built-in-copy/regexp/index.ts"
    },
    "./built-in-copy/date": {
      "import": "./src/built-in-copy/date/index.ts",
      "types": "./src/built-in-copy/date/index.ts"
    },
    "./built-in-copy/error": {
      "import": "./src/built-in-copy/error/index.ts",
      "types": "./src/built-in-copy/error/index.ts"
    },
    "./locked": {
      "import": "./src/locked/index.ts",
      "types": "./src/locked/index.ts"
    },
    "./locked-prop-descriptors": {
      "import": "./src/locked-prop-descriptors/index.ts",
      "types": "./src/locked-prop-descriptors/index.ts"
    },
    "./locked-props": {
      "import": "./src/locked-props/index.ts",
      "types": "./src/locked-props/index.ts"
    }
  }
}
```

### Phase 3: Refactor `immutable-api` Internals

Move existing utilities to the new directory structure and update internal imports:

**Before (`src/locked.ts`):**

```typescript
if (!Object.prototype.hasOwnProperty.call(this, BOUND)) {
  Object.defineProperty(this, BOUND, { ... })
}
```

**After (`src/locked/index.ts`):**

```typescript
import { hasOwn, defineProperty } from '../built-in-copy/object'

if (!hasOwn(this, BOUND)) {
  defineProperty(this, BOUND, { ... })
}
```

### Phase 4: Verify No Main Entrypoint

Ensure there is NO `libs/utils/immutable-api/src/index.ts` main entrypoint. All public API is exposed through secondary entrypoints only. This enforces explicit imports and optimal tree-shaking.

### Phase 5: Create ESLint Rules

See [ESLint Rules](#eslint-rules) section for detailed implementation.

### Phase 6: Migrate Production Code

For each file in the [Migration Inventory](#migration-inventory):

1. Add import statement for individual functions (tree-shakeable):

   ```typescript
   import { freeze, keys, entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
   import { isArray, from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
   import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
   import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
   import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
   import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
   import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
   ```

2. Update code to use imported functions:

   ```typescript
   // Before
   Object.freeze(myConfig)
   Array.isArray(value)
   JSON.parse(text)
   new Promise((resolve) => ...)
   new Map()
   new Error('message')

   // After
   freeze(myConfig)
   isArray(value)
   parse(text)
   createPromise((resolve) => ...)
   createMap()
   createError('message')
   ```

3. Run tests to verify behavior unchanged

**Migration Order:**

1. **`libs/utils/immutable-api/`** — Self-migration first (foundation)
2. **`libs/cryptography/`** — Security-critical
3. **`libs/network-protocol/`** — Security-critical, most usages
4. **`libs/utils/json/`** — Validation and parsing
5. **`libs/logging/`** — Supporting infrastructure
6. **`libs/utils/data/`** — Core utilities
7. **`libs/utils/list/`** — Collection utilities
8. **`libs/utils/time/`** — Timing utilities
9. **`libs/utils/ui/`** — UI utilities

### Phase 7: Documentation Updates

1. **Update `libs/utils/immutable-api/README.md`**:
   - Add "Security Hardening" section explaining the purpose
   - Document the tree-shakeable imports API
   - Explain why prototype methods are excluded
   - Document Promise factory functions
   - Document the ESLint rules for enforcement

2. **TSDoc** is already included in the implementation (Phase 1)

---

## ESLint Rules

Create two ESLint rules in `tools/eslint-rules/` to enforce adoption:

### Rule 1: `require-safe-builtins-entrypoint`

**Purpose:** Ensure library entry points import the correct safe builtins secondary entrypoints based on actual usage within the module tree.

**Scope:** All `index.ts` files in library projects under `libs/`

**Behavior:**

The rule performs **static analysis of the entire module tree** exported from an `index.ts`:

1. **Parse exports**: Read the `index.ts` and collect all exported symbols
2. **Walk import tree**: Recursively traverse all imported modules, building a complete dependency graph
3. **Detect built-in usage**: Identify any usage of supported built-ins (Object, Array, JSON, Promise, Reflect, Function, Symbol, Map, Set, WeakMap, WeakSet, RegExp, Date, Error) — whether safe copies or direct global access
4. **Map to entrypoints**: For each detected built-in, determine the required secondary entrypoint
5. **Error if missing**: If the `index.ts` doesn't import the corresponding `@hyperfrontend/immutable-api-utils/built-in-copy/<builtin>` entrypoint, report an error
6. **Fixable**: Automatically adds missing imports at the module top

**Built-in to Entrypoint Mapping:**

| Built-in Usage                     | Required Entrypoint                                         |
| ---------------------------------- | ----------------------------------------------------------- |
| `Object.*` or `Object.prototype.*` | `@hyperfrontend/immutable-api-utils/built-in-copy/object`   |
| `Array.*`                          | `@hyperfrontend/immutable-api-utils/built-in-copy/array`    |
| `JSON.*`                           | `@hyperfrontend/immutable-api-utils/built-in-copy/json`     |
| `new Promise` or `Promise.*`       | `@hyperfrontend/immutable-api-utils/built-in-copy/promise`  |
| `Reflect.*`                        | `@hyperfrontend/immutable-api-utils/built-in-copy/reflect`  |
| `new Function` or `Function.*`     | `@hyperfrontend/immutable-api-utils/built-in-copy/function` |
| `Symbol()` or `Symbol.*`           | `@hyperfrontend/immutable-api-utils/built-in-copy/symbol`   |
| `new Map`                          | `@hyperfrontend/immutable-api-utils/built-in-copy/map`      |
| `new Set`                          | `@hyperfrontend/immutable-api-utils/built-in-copy/set`      |
| `new WeakMap`                      | `@hyperfrontend/immutable-api-utils/built-in-copy/weak-map` |
| `new WeakSet`                      | `@hyperfrontend/immutable-api-utils/built-in-copy/weak-set` |
| `new RegExp` or `RegExp()`         | `@hyperfrontend/immutable-api-utils/built-in-copy/regexp`   |
| `new Date` or `Date.*`             | `@hyperfrontend/immutable-api-utils/built-in-copy/date`     |
| `new Error` or `*Error`            | `@hyperfrontend/immutable-api-utils/built-in-copy/error`    |

**Algorithm:**

```
FOR each index.ts in libs/:
  1. Parse AST and extract all export declarations
  2. Build module dependency graph by following imports
  3. FOR each module in graph:
       - Scan for MemberExpression: Object.*, Array.*, JSON.*, Reflect.*
       - Scan for NewExpression: new Promise, new Map, new Set, new WeakMap,
                                 new WeakSet, new RegExp, new Date, new Error, etc.
       - Scan for CallExpression: Symbol(), RegExp()
       - Track which built-ins are used
  4. Determine required entrypoints from usage
  5. Check if index.ts imports all required entrypoints
  6. Report error for each missing entrypoint with auto-fix
```

**Example Error:**

```
error: Module tree uses 'Object.freeze' but index.ts does not import
       '@hyperfrontend/immutable-api-utils/built-in-copy/object'.

       Add import to ensure safe built-in capture at module load time.

       Used in:
         - src/lib/create-channel.ts:45 (Object.freeze)
         - src/lib/create-store.ts:23 (Object.keys)

eslint(@hyperfrontend/require-safe-builtins-entrypoint)
```

**Implementation:**

```typescript
// tools/eslint-rules/src/rules/require-safe-builtins-entrypoint.ts

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import * as path from 'path'
import * as fs from 'fs'
import * as ts from 'typescript'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/hyperfrontend/hyperfrontend/blob/main/docs/eslint-rules/${name}.md`
)

// Mapping from built-in name to secondary entrypoint path
const BUILTIN_ENTRYPOINTS: Record<string, string> = {
  Object: '@hyperfrontend/immutable-api-utils/built-in-copy/object',
  Array: '@hyperfrontend/immutable-api-utils/built-in-copy/array',
  JSON: '@hyperfrontend/immutable-api-utils/built-in-copy/json',
  Promise: '@hyperfrontend/immutable-api-utils/built-in-copy/promise',
  Reflect: '@hyperfrontend/immutable-api-utils/built-in-copy/reflect',
  Function: '@hyperfrontend/immutable-api-utils/built-in-copy/function',
  Symbol: '@hyperfrontend/immutable-api-utils/built-in-copy/symbol',
  Map: '@hyperfrontend/immutable-api-utils/built-in-copy/map',
  Set: '@hyperfrontend/immutable-api-utils/built-in-copy/set',
  WeakMap: '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map',
  WeakSet: '@hyperfrontend/immutable-api-utils/built-in-copy/weak-set',
  RegExp: '@hyperfrontend/immutable-api-utils/built-in-copy/regexp',
  Date: '@hyperfrontend/immutable-api-utils/built-in-copy/date',
  Error: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
  TypeError: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
  RangeError: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
  ReferenceError: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
  SyntaxError: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
  URIError: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
  EvalError: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
  AggregateError: '@hyperfrontend/immutable-api-utils/built-in-copy/error',
}

interface BuiltinUsage {
  builtin: string
  file: string
  line: number
  expression: string
}

/**
 * Recursively walks the import tree starting from a file,
 * collecting all built-in usages.
 */
function collectBuiltinUsages(entryFile: string, visited: Set<string> = new Set()): BuiltinUsage[] {
  if (visited.has(entryFile) || !fs.existsSync(entryFile)) {
    return []
  }
  visited.add(entryFile)

  const usages: BuiltinUsage[] = []
  const content = fs.readFileSync(entryFile, 'utf-8')

  // Parse with TypeScript compiler API for accurate AST
  const sourceFile = ts.createSourceFile(entryFile, content, ts.ScriptTarget.Latest, true)

  const imports: string[] = []

  function visit(node: ts.Node) {
    // Collect imports for recursive traversal
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text
      if (specifier.startsWith('.') || specifier.startsWith('..')) {
        imports.push(specifier)
      }
    }

    // Detect: Object.keys, Array.isArray, JSON.parse, etc.
    if (ts.isPropertyAccessExpression(node)) {
      const obj = node.expression
      if (ts.isIdentifier(obj) && obj.text in BUILTIN_ENTRYPOINTS) {
        usages.push({
          builtin: obj.text,
          file: entryFile,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          expression: `${obj.text}.${node.name.text}`,
        })
      }
    }

    // Detect: new Promise, new Map, new Set, new Error, etc.
    if (ts.isNewExpression(node)) {
      const expr = node.expression
      if (ts.isIdentifier(expr) && expr.text in BUILTIN_ENTRYPOINTS) {
        usages.push({
          builtin: expr.text,
          file: entryFile,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          expression: `new ${expr.text}`,
        })
      }
    }

    // Detect: Symbol(), RegExp() as call expressions
    if (ts.isCallExpression(node)) {
      const expr = node.expression
      if (ts.isIdentifier(expr) && (expr.text === 'Symbol' || expr.text === 'RegExp')) {
        usages.push({
          builtin: expr.text,
          file: entryFile,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          expression: `${expr.text}()`,
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  // Recursively process imports
  const dir = path.dirname(entryFile)
  for (const imp of imports) {
    const resolved = resolveImport(dir, imp)
    if (resolved) {
      usages.push(...collectBuiltinUsages(resolved, visited))
    }
  }

  return usages
}

function resolveImport(fromDir: string, specifier: string): string | null {
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx']
  const basePath = path.resolve(fromDir, specifier)

  for (const ext of extensions) {
    const fullPath = basePath + ext
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  // Try without extension (might be a directory with index)
  const indexPath = path.join(basePath, 'index.ts')
  if (fs.existsSync(indexPath)) {
    return indexPath
  }

  return null
}

export const rule = createRule({
  name: 'require-safe-builtins-entrypoint',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require library entry points to import safe builtin entrypoints based on module tree usage',
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingEntrypoint:
        "Module tree uses {{ builtin }} but index.ts does not import '{{ entrypoint }}'.\n" +
        'Add import to ensure safe built-in capture at module load time.\n\n' +
        'Used in:\n{{ usageList }}',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename

    // Only check index.ts files in libs/
    if (!filename.includes('/libs/') || !filename.endsWith('/index.ts')) {
      return {}
    }

    // Skip immutable-api itself (it defines the builtins)
    if (filename.includes('/immutable-api/')) {
      return {}
    }

    // Collect all imports from this entry point
    const importedEntrypoints = new Set<string>()

    return {
      ImportDeclaration(node) {
        const source = node.source.value as string
        if (source.startsWith('@hyperfrontend/immutable-api-utils/built-in-copy/')) {
          importedEntrypoints.add(source)
        }
      },

      'Program:exit'(program) {
        // Walk the entire module tree to find built-in usages
        const usages = collectBuiltinUsages(filename)

        // Group usages by required entrypoint
        const entrypointUsages = new Map<string, BuiltinUsage[]>()

        for (const usage of usages) {
          const entrypoint = BUILTIN_ENTRYPOINTS[usage.builtin]
          if (entrypoint && !importedEntrypoints.has(entrypoint)) {
            if (!entrypointUsages.has(entrypoint)) {
              entrypointUsages.set(entrypoint, [])
            }
            entrypointUsages.get(entrypoint)!.push(usage)
          }
        }

        // Report missing entrypoints
        for (const [entrypoint, usageList] of entrypointUsages) {
          // Deduplicate and format usage list
          const uniqueUsages = usageList
            .slice(0, 5) // Limit to 5 examples
            .map((u) => `  - ${path.relative(path.dirname(filename), u.file)}:${u.line} (${u.expression})`)
            .join('\n')

          const builtin = Object.entries(BUILTIN_ENTRYPOINTS).find(([_, ep]) => ep === entrypoint)?.[0] || 'unknown'

          context.report({
            node: program,
            messageId: 'missingEntrypoint',
            data: {
              builtin,
              entrypoint,
              usageList: uniqueUsages,
            },
            fix(fixer) {
              const importStatement = `import '${entrypoint}'\n`
              return fixer.insertTextBefore(program.body[0], importStatement)
            },
          })
        }
      },
    }
  },
})
```

### Rule 2: `no-unsafe-builtins`

**Purpose:** Warn when code directly uses global builtins that should be imported from `@hyperfrontend/immutable-api-utils`.

**Scope:** All `.ts` files in `libs/` (excluding test files and `built-in-copy/**` files)

**Behavior:**

- **Warning** when detecting direct usage of `Object.`, `Array.`, `JSON.`, `new Promise(...)`, `Reflect.`, `Symbol()`, `new Map`, `new Set`, `new WeakMap`, `new WeakSet`, `new RegExp`, `RegExp()`, `new Date`, `Date.`, `new Error`, `new TypeError`, etc.
- **Catches destructuring**: `const { freeze } = Object`
- **Catches dynamic access**: `Object['keys']`
- **Suggests** importing from `@hyperfrontend/immutable-api-utils/built-in-copy/<builtin>`
- **Not auto-fixable** (requires developer decision on which methods to import)

**Implementation:**

```typescript
// tools/eslint-rules/src/rules/no-unsafe-builtins.ts

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/hyperfrontend/hyperfrontend/blob/main/docs/eslint-rules/${name}.md`
)

const UNSAFE_GLOBALS = [
  'Object',
  'Array',
  'JSON',
  'Promise',
  'Reflect',
  'Function',
  'Symbol',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'RegExp',
  'Date',
]

const ERROR_CONSTRUCTORS = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError']

const BUILTIN_TO_ENTRYPOINT: Record<string, string> = {
  Object: 'object',
  Array: 'array',
  JSON: 'json',
  Promise: 'promise',
  Reflect: 'reflect',
  Function: 'function',
  Symbol: 'symbol',
  Map: 'map',
  Set: 'set',
  WeakMap: 'weak-map',
  WeakSet: 'weak-set',
  RegExp: 'regexp',
  Date: 'date',
  Error: 'error',
  TypeError: 'error',
  RangeError: 'error',
  ReferenceError: 'error',
  SyntaxError: 'error',
  URIError: 'error',
  EvalError: 'error',
  AggregateError: 'error',
}

export const rule = createRule({
  name: 'no-unsafe-builtins',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow direct usage of global builtins that should be imported from immutable-api',
    },
    schema: [],
    messages: {
      unsafeBuiltin:
        'Avoid direct usage of global {{ name }}. Import from ' +
        '@hyperfrontend/immutable-api-utils/built-in-copy/{{ entrypoint }} instead.',
      unsafeDestructure:
        'Avoid destructuring from global {{ name }}. Import individual functions from ' +
        '@hyperfrontend/immutable-api-utils/built-in-copy/{{ entrypoint }} instead.',
      unsafeConstructor:
        'Avoid `new {{ name }}(...)`. Use corresponding factory function from ' +
        '@hyperfrontend/immutable-api-utils/built-in-copy/{{ entrypoint }} instead.',
      unsafeSymbolCall:
        'Avoid `Symbol(...)`. Use `createSymbol()` from ' + '@hyperfrontend/immutable-api-utils/built-in-copy/symbol instead.',
      unsafeRegExpCall:
        'Avoid `RegExp(...)`. Use `createRegExp()` from ' + '@hyperfrontend/immutable-api-utils/built-in-copy/regexp instead.',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename

    // Only check files in libs/
    if (!filename.includes('/libs/')) {
      return {}
    }

    // Skip test files
    if (filename.match(/\.(spec|test|e2e)\.ts$/)) {
      return {}
    }

    // Skip the built-in-copy files themselves
    if (filename.includes('/built-in-copy/')) {
      return {}
    }

    // Track imported names from our safe package to avoid false positives
    const importedNames = new Set<string>()

    return {
      ImportDeclaration(node) {
        const source = node.source.value as string
        if (source.startsWith('@hyperfrontend/immutable-api-utils/built-in-copy/')) {
          node.specifiers.forEach((spec) => {
            if (spec.type === 'ImportSpecifier') {
              importedNames.add(spec.local.name)
            }
          })
        }
      },

      // Catch: Object.keys, Array.isArray, Date.now, etc.
      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return

        const name = node.object.name
        if (UNSAFE_GLOBALS.includes(name) && !importedNames.has(name)) {
          context.report({
            node: node.object,
            messageId: 'unsafeBuiltin',
            data: { name, entrypoint: BUILTIN_TO_ENTRYPOINT[name] },
          })
        }
      },

      // Catch: const { keys, entries } = Object
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern') return
        if (node.init?.type !== 'Identifier') return

        const name = node.init.name
        if (UNSAFE_GLOBALS.includes(name) && !importedNames.has(name)) {
          context.report({
            node: node.init,
            messageId: 'unsafeDestructure',
            data: { name, entrypoint: BUILTIN_TO_ENTRYPOINT[name] },
          })
        }
      },

      // Catch: new Promise(...), new Map(), new Set(), new Error(), etc.
      NewExpression(node) {
        if (node.callee.type !== 'Identifier') return

        const name = node.callee.name

        // Check standard globals
        if (UNSAFE_GLOBALS.includes(name) && !importedNames.has(name)) {
          context.report({
            node: node.callee,
            messageId: 'unsafeConstructor',
            data: { name, entrypoint: BUILTIN_TO_ENTRYPOINT[name] },
          })
          return
        }

        // Check error constructors
        if (ERROR_CONSTRUCTORS.includes(name)) {
          context.report({
            node: node.callee,
            messageId: 'unsafeConstructor',
            data: { name, entrypoint: 'error' },
          })
        }
      },

      // Catch: Symbol(), RegExp() as call expressions
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return

        const name = node.callee.name

        if (name === 'Symbol') {
          context.report({
            node: node.callee,
            messageId: 'unsafeSymbolCall',
          })
        } else if (name === 'RegExp') {
          context.report({
            node: node.callee,
            messageId: 'unsafeRegExpCall',
          })
        }
      },
    }
  },
})
```

### ESLint Configuration

Add to `eslint.config.cjs`:

```javascript
module.exports = [
  // ... existing config
  {
    files: ['libs/**/*.ts'],
    ignores: ['libs/**/*.spec.ts', 'libs/**/*.test.ts', 'libs/**/built-in-copy/**'],
    rules: {
      '@hyperfrontend/require-safe-builtins-entrypoint': 'error',
      '@hyperfrontend/no-unsafe-builtins': 'warn',
    },
  },
]
```

---

## Migration Inventory

### Summary Statistics

| Package                     | Production Files | Total Usages   |
| --------------------------- | ---------------- | -------------- |
| `libs/network-protocol/`    | 27               | 35+            |
| `libs/utils/json/`          | 9                | 15+            |
| `libs/cryptography/`        | 4                | 6              |
| `libs/utils/immutable-api/` | 2                | 3              |
| `libs/utils/list/`          | 3                | 5              |
| `libs/utils/data/`          | 2                | 4              |
| `libs/utils/time/`          | 3                | 4              |
| `libs/utils/ui/`            | 5                | 7              |
| `libs/logging/`             | 2                | 2              |
| **Total**                   | **57 files**     | **81+ usages** |

### Files Excluded from Migration

These files are intentionally excluded (not shipped to consumers):

- `**/*.spec.ts` — Test files
- `**/*.test.ts` — Test files
- `**/*.e2e.ts` — E2E test files
- `**/jest.config.*` — Jest configuration
- `**/jest.preset.*` — Jest presets
- `**/jest.setup.ts` — Jest setup (uses Object.assign/defineProperty for mocking)
- `**/test-utils/**` — Test utilities
- `**/testing/**` — Testing infrastructure
- `tools/**` — Build tooling (not shipped)
- `apps/**` — Applications (not library code)

---

## Acceptance Criteria

### Phase 1

- [ ] `built-in-copy/` directory created with subdirectories: object, array, json, promise, reflect, function, symbol, map, set, weak-map, weak-set, regexp, date, error
- [ ] Each subdirectory contains an `index.ts` file (lowercase-kebab-style naming)
- [ ] All methods are captured at module load time (const assignments)
- [ ] Individual exports available for tree-shaking
- [ ] Namespace objects available for convenience (frozen)
- [ ] Type definitions inferred correctly (full IntelliSense)
- [ ] JSDoc comments copied with "(Safe copy)" indicator
- [ ] `hasOwn()` and `typeTag()` convenience utilities use `Reflect.apply`
- [ ] Promise factory functions implemented (`createPromise`, `promiseAll`, etc.)
- [ ] Factory functions implemented for: Map, Set, WeakMap, WeakSet, RegExp, Date, Error (and all Error subtypes)
- [ ] Symbol factory and well-known symbols captured
- [ ] No runtime dependencies on external packages

### Phase 2

- [ ] `package.json` exports field configured for all secondary entrypoints
- [ ] No main entrypoint (`.`) exported — enforces explicit imports
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/object` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/array` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/json` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/promise` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/reflect` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/function` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/symbol` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/map` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/set` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/weak-map` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/weak-set` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/regexp` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/date` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/built-in-copy/error` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/locked` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/locked-prop-descriptors` resolves correctly
- [ ] `@hyperfrontend/immutable-api-utils/locked-props` resolves correctly

### Phase 3

- [ ] `src/locked/index.ts` imports from `../built-in-copy/object` and uses safe references
- [ ] `src/locked-props/index.ts` imports from `../built-in-copy/object` and uses safe references
- [ ] All existing tests pass

### Phase 4

- [ ] No main entrypoint exists (`src/index.ts` should not exist)
- [ ] All public API is accessible only through secondary entrypoints
- [ ] Tree-shaking verified: importing only `freeze` doesn't bundle `keys`, `entries`, etc.

### Phase 5

- [ ] `require-safe-builtins-entrypoint` ESLint rule created in `tools/eslint-rules/`
- [ ] Rule walks module import tree to detect built-in usage
- [ ] Rule maps detected usage to required entrypoints
- [ ] Rule reports missing entrypoints with file/line references
- [ ] `no-unsafe-builtins` ESLint rule created in `tools/eslint-rules/`
- [ ] `no-unsafe-builtins` catches all supported globals (Object, Array, JSON, Promise, Reflect, Function, Symbol, Map, Set, WeakMap, WeakSet, RegExp, Date, Error types)
- [ ] `no-unsafe-builtins` catches destructuring patterns
- [ ] `no-unsafe-builtins` catches `new Promise(...)`, `new Map()`, `new Error()`, etc.
- [ ] `no-unsafe-builtins` catches `Symbol()` and `RegExp()` call expressions
- [ ] Both rules have tests
- [ ] Rules integrated into ESLint config for `libs/` files
- [ ] `require-safe-builtins-entrypoint` is auto-fixable

### Phase 6

- [ ] All production files migrated (see Migration Inventory)
- [ ] No ESLint warnings from `no-unsafe-builtins` in production `libs/`
- [ ] All existing tests pass

### Phase 7

- [ ] `libs/utils/immutable-api/README.md` updated with:
  - [ ] "Security Hardening" section explaining the purpose
  - [ ] Tree-shakeable imports documentation (secondary entrypoints only)
  - [ ] Factory function documentation (Promise, Map, Set, etc.)
  - [ ] Explanation of why prototype methods are excluded
  - [ ] ESLint rules documented

---

## Security Considerations

### Limitations

1. **First-Mover Advantage**: If malicious code executes before our capture module, we capture poisoned methods
2. **Import Order**: Consumers must import the appropriate entrypoints early in their entry point
3. **Supply Chain**: Attacks that modify source code directly are not mitigated
4. **Bundler Transformations**: Some bundlers may inline or transform captured references (see [Bundler Configuration](#bundler-configuration))
5. **Bootstrap Dependencies**: Wrapper functions like `hasOwn()` rely on `Reflect.apply`, which is itself captured — if `Reflect.apply` is poisoned first, wrappers are compromised
6. **Prototype Methods Are Unprotected**: `array.map()`, `promise.then()`, `map.get()` always use global prototypes — no practical protection possible

### Cross-Realm Considerations

Objects created in different JavaScript realms (iframes, Node.js `vm` contexts) have distinct prototypes:

- `Array.isArray()` works correctly across realms (checks internal slot, not prototype)
- `instanceof Array` fails across realms (checks prototype chain)

**Recommendation:** Audit codebase for `instanceof Array` usage and replace with `isArray()` from this module.

### Recommendations

1. **Entry Point Import**: Document that appropriate `@hyperfrontend/immutable-api-utils/built-in-copy/*` entrypoints should be imported before any third-party code
2. **Subresource Integrity**: Use SRI hashes for CDN distributions
3. **Lock File Auditing**: Regularly audit `package-lock.json` for unexpected changes
4. **CSP Headers**: When serving library code, use restrictive Content-Security-Policy

### Out of Scope

- Sensitive data handling (PIDs, keys, credentials) — separate security consideration
- Web Worker isolation — different security boundary
- Node.js `vm` module attacks — out of scope for browser library
- Instance/prototype method protection — fundamentally unusable in practice (e.g., `map.get()`, `set.add()`, `array.map()`)

---

## Bundler Configuration

To prevent bundlers from inlining the captured references back to globals, configure your bundler appropriately:

### esbuild

```javascript
// esbuild.config.js
export default {
  // Prevent pure annotation removal that could inline globals
  treeShaking: true,
  // Don't minify identifiers in ways that might confuse the reference capture
  keepNames: true,
}
```

### Rollup

```javascript
// rollup.config.js
export default {
  output: {
    // Preserve module structure to prevent aggressive inlining
    preserveModules: true,
  },
  treeshake: {
    // Don't assume module side effects can be removed
    moduleSideEffects: true,
  },
}
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    // Prevent module concatenation that might inline references
    concatenateModules: false,
    // Or use a more targeted approach:
    // concatenateModules: true,
    // with explicit sideEffects: true in package.json
  },
}
```

### Terser / Minification

```javascript
// terser.config.js
export default {
  compress: {
    // Don't evaluate or inline constant expressions
    evaluate: false,
    // Don't inline captured references
    inline: false,
    // Keep function references intact
    reduce_funcs: false,
  },
}
```

### Verifying Tree-Shaking

After building, verify that:

1. Importing only `{ freeze }` doesn't include `keys`, `entries`, etc.
2. The captured `_Object`, `_Array` references are preserved (not replaced with `Object`, `Array`)

```bash
# Check bundle size difference
esbuild --bundle --minify test-freeze-only.ts --outfile=freeze.js
esbuild --bundle --minify test-all-object.ts --outfile=all.js
ls -la freeze.js all.js
```
