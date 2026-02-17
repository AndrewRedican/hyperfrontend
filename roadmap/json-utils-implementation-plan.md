# JSON Schema Utilities Implementation Plan

## Executive Summary

This document outlines the implementation of `@hyperfrontend/json-utils`, a zero-dependency JSON Schema validation and generation library under `libs/utils/json`. This replaces external dependencies `jsonschema` (v1.5.0) and `to-json-schema` (v0.2.5) with a right-sized, functional-programming-first implementation.

**Dependencies to eliminate:**

- `jsonschema` - JSON Schema Draft v4 validation
- `to-json-schema` - Schema generation from JavaScript values
- `@types/to-json-schema` - TypeScript definitions

**Affected packages:**

- `@hyperfrontend/network-protocol` - Uses both packages
- `@hyperfrontend/nexus` - Uses `jsonschema` for validation

---

## Part 1: Usage Analysis (Working Backwards)

### 1.1 Exact API Surface Used

#### `jsonschema` Package

| File                                                                                                                                   | APIs Used                  | Purpose                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
| [libs/nexus/src/schema/validate/create-validator.ts](libs/nexus/src/schema/validate/create-validator.ts)                               | `Validator`, `Schema` type | Create reusable validator functions         |
| [libs/network-protocol/src/lib/data/validations/is-valid-schema.ts](libs/network-protocol/src/lib/data/validations/is-valid-schema.ts) | `Validator.validate()`     | Validate if value is a valid JSON Schema v4 |
| Various files                                                                                                                          | `Schema` type              | Type annotations only                       |

**Actual code patterns used:**

```typescript
// Pattern 1: Create validator instance, call validate
const validator = new Validator()
const result = validator.validate(data, schema)

// Pattern 2: Access result properties
result.valid // boolean
result.errors // ValidationError[]
error.message // string
error.property // string (path like "instance.foo.bar")
error.instance // any (the failing value)
```

#### `to-json-schema` Package

| File                                                                                                                   | APIs Used        | Purpose                           |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------- |
| [libs/network-protocol/src/lib/data/creators/get-schema.ts](libs/network-protocol/src/lib/data/creators/get-schema.ts) | `toJsonSchema()` | Generate schema from data samples |

**Actual code patterns used:**

```typescript
// Single usage pattern
const schema = toJsonSchema(data, { arrays: { mode: 'all' } })
```

### 1.2 Validation Scope Analysis

#### Internal Validation (Controlled Schemas)

These are schemas defined within the codebase itself:

| Schema                | File                                                     | Keywords Used                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v4.json (meta-schema) | `libs/network-protocol/src/lib/data/validations/v4.json` | `type`, `properties`, `required`, `items`, `minItems`, `uniqueItems`, `additionalProperties`, `anyOf`, `allOf`, `enum`, `minimum`, `exclusiveMinimum`, `default`, `$ref`, `format` |
| action.json           | `libs/nexus/src/schema/definitions/action.json`          | `type`, `required`, `properties`, `pattern`                                                                                                                                        |
| contract.json         | `libs/nexus/src/schema/definitions/contract.json`        | `type`, `required`, `properties`, `items`                                                                                                                                          |
| message.json          | `libs/nexus/src/schema/definitions/message.json`         | `type`, `required`, `properties`                                                                                                                                                   |

#### User-Provided Validation (Open Schemas)

Users can provide arbitrary JSON Schema v4 in:

```typescript
// From libs/nexus/src/types/contract.ts
export interface IActionDescription {
  type: string
  description?: string
  schema?: object // <-- User-provided JSON Schema
}
```

**Implication:** The validator must support the full JSON Schema Draft v4 keyword set since users may provide any valid schema.

### 1.3 Keywords Classification

#### Must Implement (Used internally + User contracts)

| Category        | Keywords                                                                   | Priority                |
| --------------- | -------------------------------------------------------------------------- | ----------------------- |
| **Type**        | `type`                                                                     | Critical                |
| **Object**      | `properties`, `required`, `additionalProperties`                           | Critical                |
| **Array**       | `items`, `minItems`, `maxItems`, `additionalItems`                         | Critical                |
| **String**      | `minLength`, `maxLength`, `pattern`                                        | Critical                |
| **Number**      | `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` | Critical                |
| **Composition** | `allOf`, `anyOf`, `oneOf`, `not`                                           | Critical                |
| **Reference**   | `$ref`, `definitions`                                                      | Critical                |
| **Enum**        | `enum`                                                                     | Critical                |
| **Meta**        | `$schema`, `id`, `title`, `description`, `default`                         | Metadata (pass-through) |

#### Should Implement (For full v4 compliance)

| Category   | Keywords                                                              | Priority |
| ---------- | --------------------------------------------------------------------- | -------- |
| **Object** | `patternProperties`, `minProperties`, `maxProperties`, `dependencies` | High     |
| **Array**  | `uniqueItems`                                                         | High     |
| **Format** | `format` (string formats)                                             | Medium   |

#### Deferred (Not in v4 core)

| Category | Keywords                                             | Notes               |
| -------- | ---------------------------------------------------- | ------------------- |
| Draft 6+ | `const`, `contains`, `propertyNames`, `if/then/else` | Not required for v4 |

---

## Part 2: Internal Library Reuse

### 2.1 From `@hyperfrontend/data-utils`

The following utilities can be leveraged:

| Function                    | Purpose in JSON Schema                               |
| --------------------------- | ---------------------------------------------------- |
| `getType(value)`            | Type detection for primitives, arrays, objects, null |
| `isIdentical(a, b)`         | Deep equality for `uniqueItems`, `enum` checking     |
| `sameStructure(a, b)`       | Structure comparison                                 |
| `hasCircularReference(obj)` | Detect circular refs in schema/data                  |

### 2.2 Internal Design Decisions

**Do not use:**

- `isIterable`, `getIterableOperators` - Over-abstracted for our needs

**Create fresh:**

- Path tracking utilities (JSON Pointer format)
- Schema resolution ($ref handling)
- Error collection and formatting

---

## Part 3: Library Structure

### 3.1 File Organization

```
libs/utils/json/
├── project.json
├── package.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
├── README.md
├── src/
│   ├── index.ts                          # Public API exports
│   │
│   ├── types/
│   │   ├── schema.ts                     # Schema type definition
│   │   ├── validation.ts                 # ValidationResult, ValidationError
│   │   └── index.ts
│   │
│   ├── validate/
│   │   ├── create-validator.ts           # createValidator factory
│   │   ├── validate.ts                   # validate function
│   │   ├── context.ts                    # createValidationContext factory
│   │   ├── resolve-ref.ts                # resolveRef for $ref handling
│   │   ├── index.ts
│   │   │
│   │   └── keywords/
│   │       ├── type.ts                   # type keyword
│   │       ├── properties.ts             # properties, required, additionalProperties
│   │       ├── pattern-properties.ts     # patternProperties
│   │       ├── items.ts                  # items, additionalItems
│   │       ├── array-bounds.ts           # minItems, maxItems, uniqueItems
│   │       ├── string-bounds.ts          # minLength, maxLength, pattern
│   │       ├── number-bounds.ts          # minimum, maximum, multipleOf
│   │       ├── enum.ts                   # enum keyword
│   │       ├── composition.ts            # allOf, anyOf, oneOf, not
│   │       ├── object-bounds.ts          # minProperties, maxProperties
│   │       ├── dependencies.ts           # dependencies keyword
│   │       ├── format.ts                 # format keyword (string formats)
│   │       └── index.ts
│   │
│   └── generate/
│       ├── to-json-schema.ts             # toJsonSchema function
│       ├── type-detection.ts             # getJsonType helper
│       ├── merge-schemas.ts              # mergeSchemas for array mode: 'all'
│       └── index.ts
```

### 3.2 Path Alias Configuration

Add to `tsconfig.base.json`:

```jsonc
"@hyperfrontend/json-utils": ["libs/utils/json/src/index.ts"]
```

### 3.3 Project Configuration

**project.json:**

```json
{
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "name": "lib-json-utils",
  "description": "Zero-dependency JSON Schema validation and generation utilities.",
  "sourceRoot": "{projectRoot}/src",
  "projectType": "library",
  "tags": ["type:util", "scope:public"],
  "targets": {
    "version": {},
    "build": {
      "executor": "@hyperfrontend/package:build",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendJsonUtils"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendJsonUtils"
        }
      }
    },
    "publish": {},
    "typecheck": {}
  }
}
```

**package.json:**

```json
{
  "name": "@hyperfrontend/json-utils",
  "version": "0.0.1",
  "description": "Zero-dependency JSON Schema validation and generation utilities.",
  "license": "MIT",
  "sideEffects": false,
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "main": "./src/index.js",
  "keywords": ["json-schema", "validation", "schema-generation", "draft-04", "zero-dependencies", "typescript", "isomorphic"],
  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/AndrewRedican"
  }
}
```

---

## Part 4: Public API Design

### 4.1 Type Definitions

```typescript
// src/types/schema.ts

/**
 * JSON Schema Draft v4 type definition.
 * Represents the structure of a JSON Schema document.
 */
export interface Schema {
  /** Schema identifier */
  $id?: string
  /** Draft version */
  $schema?: string
  /** Reference to another schema */
  $ref?: string
  /** Human-readable title */
  title?: string
  /** Human-readable description */
  description?: string
  /** Default value */
  default?: unknown

  /** Type constraint */
  type?: JsonType | JsonType[]

  /** Enum constraint */
  enum?: unknown[]

  /** Object properties */
  properties?: Record<string, Schema>
  /** Required property names */
  required?: string[]
  /** Additional properties schema or boolean */
  additionalProperties?: boolean | Schema
  /** Pattern-based property schemas */
  patternProperties?: Record<string, Schema>
  /** Property dependencies */
  dependencies?: Record<string, Schema | string[]>
  /** Minimum properties count */
  minProperties?: number
  /** Maximum properties count */
  maxProperties?: number

  /** Array items schema */
  items?: Schema | Schema[]
  /** Additional items schema */
  additionalItems?: boolean | Schema
  /** Minimum items count */
  minItems?: number
  /** Maximum items count */
  maxItems?: number
  /** Unique items constraint */
  uniqueItems?: boolean

  /** Minimum string length */
  minLength?: number
  /** Maximum string length */
  maxLength?: number
  /** String pattern (regex) */
  pattern?: string
  /** String format */
  format?: string

  /** Minimum number value */
  minimum?: number
  /** Maximum number value */
  maximum?: number
  /** Exclusive minimum (Draft 4: boolean) */
  exclusiveMinimum?: boolean
  /** Exclusive maximum (Draft 4: boolean) */
  exclusiveMaximum?: boolean
  /** Number must be multiple of this value */
  multipleOf?: number

  /** All schemas must match */
  allOf?: Schema[]
  /** At least one schema must match */
  anyOf?: Schema[]
  /** Exactly one schema must match */
  oneOf?: Schema[]
  /** Schema must not match */
  not?: Schema

  /** Reusable schema definitions */
  definitions?: Record<string, Schema>
}

/**
 * JSON Schema type values.
 */
export type JsonType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'
```

```typescript
// src/types/validation.ts

/**
 * Individual validation error.
 */
export interface ValidationError {
  /** Human-readable error message */
  message: string
  /** JSON Pointer path to the failing value */
  path: string
  /** The keyword that failed validation */
  keyword: string
  /** The value that failed validation */
  instance: unknown
  /** Additional keyword-specific parameters */
  params?: Record<string, unknown>
}

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[]
}

/**
 * Options for validation operations.
 */
export interface ValidateOptions {
  /** Whether to collect all errors or stop at first (default: true) */
  collectAllErrors?: boolean
}
```

### 4.2 Validation API

```typescript
// src/index.ts - Public exports

// Types
export type { Schema, JsonType } from './types/schema'
export type { ValidationError, ValidationResult, ValidateOptions } from './types/validation'

// Validation
export { validate } from './validate/validate'
export { createValidator } from './validate/create-validator'

// Generation
export type { GenerateOptions } from './generate/to-json-schema'
export { toJsonSchema } from './generate/to-json-schema'
```

---

## Part 5: Implementation Details

### 5.1 Validation Context (Functional Approach)

```typescript
// src/validate/context.ts

import type { Schema, ValidationError } from '../types'

/**
 * Validation context tracks current path and collects errors.
 */
export interface ValidationContext {
  /** Current JSON Pointer path */
  readonly path: string
  /** Root schema for $ref resolution */
  readonly rootSchema: Schema
  /** Collected validation errors */
  readonly errors: ValidationError[]
  /** Resolved definitions cache */
  readonly definitions: Map<string, Schema>
}

/**
 * Creates a new validation context.
 *
 * @param rootSchema - The root schema being validated against
 * @returns A new validation context
 */
export function createValidationContext(rootSchema: Schema): ValidationContext {
  return {
    path: '',
    rootSchema,
    errors: [],
    definitions: new Map(),
  }
}

/**
 * Creates a child context with updated path.
 *
 * @param ctx - Parent context
 * @param segment - Path segment to append
 * @returns New context with updated path
 */
export function pushPath(ctx: ValidationContext, segment: string | number): ValidationContext {
  const escapedSegment = String(segment).replace(/~/g, '~0').replace(/\//g, '~1')
  return {
    ...ctx,
    path: `${ctx.path}/${escapedSegment}`,
  }
}

/**
 * Adds a validation error to the context.
 *
 * @param ctx - Current context
 * @param keyword - The keyword that failed
 * @param message - Error message
 * @param instance - The failing value
 * @param params - Optional additional parameters
 */
export function addError(
  ctx: ValidationContext,
  keyword: string,
  message: string,
  instance: unknown,
  params?: Record<string, unknown>
): void {
  ctx.errors.push({
    path: ctx.path || '/',
    keyword,
    message,
    instance,
    params,
  })
}
```

### 5.2 Reference Resolution

```typescript
// src/validate/resolve-ref.ts

import type { Schema, ValidationContext } from '../types'

/**
 * Resolves a $ref JSON Pointer to its target schema.
 * Supports internal references only (same-document JSON Pointers).
 *
 * @param ref - The $ref value (e.g., "#/definitions/User")
 * @param ctx - Validation context containing root schema
 * @returns Resolved schema or undefined if not found
 */
export function resolveRef(ref: string, ctx: ValidationContext): Schema | undefined {
  // Only support internal references
  if (!ref.startsWith('#')) {
    return undefined
  }

  // Check cache first
  if (ctx.definitions.has(ref)) {
    return ctx.definitions.get(ref)
  }

  // Parse JSON Pointer
  const pointer = ref.slice(1) // Remove leading '#'
  if (pointer === '' || pointer === '/') {
    return ctx.rootSchema
  }

  const segments = pointer.split('/').slice(1) // Remove empty first segment
  let current: unknown = ctx.rootSchema

  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }

    // Unescape JSON Pointer encoding
    const unescaped = segment.replace(/~1/g, '/').replace(/~0/g, '~')

    if (Array.isArray(current)) {
      const index = parseInt(unescaped, 10)
      if (isNaN(index) || index < 0 || index >= current.length) {
        return undefined
      }
      current = current[index]
    } else {
      current = (<Record<string, unknown>>current)[unescaped]
    }
  }

  // Cache and return
  const resolved = <Schema>current
  ctx.definitions.set(ref, resolved)
  return resolved
}
```

### 5.3 Type Keyword Validation

```typescript
// src/validate/keywords/type.ts

import type { Schema, ValidationContext } from '../../types'
import { addError } from '../context'

/**
 * Type checking functions for JSON Schema types.
 */
const typeCheckers: Record<string, (value: unknown) => boolean> = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && isFinite(v),
  integer: (v) => typeof v === 'number' && isFinite(v) && Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  array: (v) => Array.isArray(v),
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  null: (v) => v === null,
}

/**
 * Validates the 'type' keyword.
 *
 * @param instance - Value to validate
 * @param schema - Schema containing type keyword
 * @param ctx - Validation context
 * @returns true if validation passed
 */
export function validateType(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const schemaType = schema.type
  if (schemaType === undefined) {
    return true
  }

  const types = Array.isArray(schemaType) ? schemaType : [schemaType]

  for (const type of types) {
    const checker = typeCheckers[type]
    if (checker && checker(instance)) {
      return true
    }
  }

  addError(ctx, 'type', `Expected type ${JSON.stringify(schemaType)} but got ${getActualType(instance)}`, instance, {
    expected: schemaType,
    actual: getActualType(instance),
  })

  return false
}

/**
 * Gets the actual JSON type of a value.
 */
function getActualType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') {
    if (!isFinite(value)) return 'number'
    return Number.isInteger(value) ? 'integer' : 'number'
  }
  return typeof value
}
```

### 5.4 Object Keywords Validation

```typescript
// src/validate/keywords/properties.ts

import type { Schema, ValidationContext } from '../../types'
import { addError, pushPath } from '../context'
import { validateSchema } from '../validate'

/**
 * Validates object 'properties' keyword.
 *
 * @param instance - Object to validate
 * @param schema - Schema with properties
 * @param ctx - Validation context
 * @returns true if validation passed
 */
export function validateProperties(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.properties) {
    return true
  }

  let valid = true
  const props = schema.properties

  for (const key of Object.keys(props)) {
    if (key in instance) {
      const propSchema = props[key]
      const propCtx = pushPath(ctx, key)
      if (propSchema && !validateSchema(instance[key], propSchema, propCtx)) {
        valid = false
      }
    }
  }

  return valid
}

/**
 * Validates object 'required' keyword.
 *
 * @param instance - Object to validate
 * @param schema - Schema with required
 * @param ctx - Validation context
 * @returns true if validation passed
 */
export function validateRequired(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.required) {
    return true
  }

  let valid = true

  for (const key of schema.required) {
    if (!(key in instance)) {
      addError(ctx, 'required', `Missing required property '${key}'`, instance, { missing: key })
      valid = false
    }
  }

  return valid
}

/**
 * Validates object 'additionalProperties' keyword.
 *
 * @param instance - Object to validate
 * @param schema - Schema with additionalProperties
 * @param ctx - Validation context
 * @returns true if validation passed
 */
export function validateAdditionalProperties(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  const additionalProperties = schema.additionalProperties

  // undefined or true means allow all
  if (additionalProperties === undefined || additionalProperties === true) {
    return true
  }

  const definedKeys = new Set<string>()

  // Collect keys from properties
  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      definedKeys.add(key)
    }
  }

  // Collect keys matching patternProperties
  if (schema.patternProperties) {
    const patterns = Object.keys(schema.patternProperties).map((p) => new RegExp(p))
    for (const key of Object.keys(instance)) {
      for (const pattern of patterns) {
        if (pattern.test(key)) {
          definedKeys.add(key)
          break
        }
      }
    }
  }

  let valid = true

  for (const key of Object.keys(instance)) {
    if (!definedKeys.has(key)) {
      if (additionalProperties === false) {
        addError(ctx, 'additionalProperties', `Additional property '${key}' is not allowed`, instance[key], {
          property: key,
        })
        valid = false
      } else {
        // additionalProperties is a schema
        const propCtx = pushPath(ctx, key)
        if (!validateSchema(instance[key], additionalProperties, propCtx)) {
          valid = false
        }
      }
    }
  }

  return valid
}
```

### 5.5 Array Keywords Validation

```typescript
// src/validate/keywords/items.ts

import type { Schema, ValidationContext } from '../../types'
import { addError, pushPath } from '../context'
import { validateSchema } from '../validate'

/**
 * Validates array 'items' keyword.
 *
 * @param instance - Array to validate
 * @param schema - Schema with items
 * @param ctx - Validation context
 * @returns true if validation passed
 */
export function validateItems(instance: unknown[], schema: Schema, ctx: ValidationContext): boolean {
  const items = schema.items

  if (items === undefined) {
    return true
  }

  let valid = true

  if (Array.isArray(items)) {
    // Tuple validation
    for (let i = 0; i < items.length && i < instance.length; i++) {
      const itemSchema = items[i]
      const itemCtx = pushPath(ctx, i)
      if (itemSchema && !validateSchema(instance[i], itemSchema, itemCtx)) {
        valid = false
      }
    }

    // Handle additionalItems for tuple
    if (instance.length > items.length) {
      valid = validateAdditionalItems(instance, schema, ctx, items.length) && valid
    }
  } else {
    // Single schema for all items
    for (let i = 0; i < instance.length; i++) {
      const itemCtx = pushPath(ctx, i)
      if (!validateSchema(instance[i], items, itemCtx)) {
        valid = false
      }
    }
  }

  return valid
}

/**
 * Validates 'additionalItems' keyword.
 */
function validateAdditionalItems(instance: unknown[], schema: Schema, ctx: ValidationContext, startIndex: number): boolean {
  const additionalItems = schema.additionalItems

  if (additionalItems === undefined || additionalItems === true) {
    return true
  }

  if (additionalItems === false) {
    if (instance.length > startIndex) {
      addError(ctx, 'additionalItems', `Array has additional items starting at index ${startIndex}`, instance, {
        limit: startIndex,
        actual: instance.length,
      })
      return false
    }
    return true
  }

  // additionalItems is a schema
  let valid = true
  for (let i = startIndex; i < instance.length; i++) {
    const itemCtx = pushPath(ctx, i)
    if (!validateSchema(instance[i], additionalItems, itemCtx)) {
      valid = false
    }
  }

  return valid
}
```

### 5.6 Composition Keywords

```typescript
// src/validate/keywords/composition.ts

import type { Schema, ValidationContext } from '../../types'
import { addError, createValidationContext } from '../context'
import { validateSchema } from '../validate'

/**
 * Validates 'allOf' keyword - all schemas must match.
 */
export function validateAllOf(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const allOf = schema.allOf
  if (!allOf) {
    return true
  }

  let valid = true
  for (let i = 0; i < allOf.length; i++) {
    const subSchema = allOf[i]
    if (subSchema && !validateSchema(instance, subSchema, ctx)) {
      valid = false
    }
  }

  return valid
}

/**
 * Validates 'anyOf' keyword - at least one schema must match.
 */
export function validateAnyOf(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const anyOf = schema.anyOf
  if (!anyOf) {
    return true
  }

  for (const subSchema of anyOf) {
    // Create isolated context to check without side effects
    const testCtx = createValidationContext(ctx.rootSchema)
    if (subSchema && validateSchema(instance, subSchema, testCtx)) {
      return true
    }
  }

  addError(ctx, 'anyOf', 'Value does not match any schema in anyOf', instance, {
    schemas: anyOf.length,
  })

  return false
}

/**
 * Validates 'oneOf' keyword - exactly one schema must match.
 */
export function validateOneOf(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const oneOf = schema.oneOf
  if (!oneOf) {
    return true
  }

  let matchCount = 0
  const matchingIndices: number[] = []

  for (let i = 0; i < oneOf.length; i++) {
    const subSchema = oneOf[i]
    const testCtx = createValidationContext(ctx.rootSchema)
    if (subSchema && validateSchema(instance, subSchema, testCtx)) {
      matchCount++
      matchingIndices.push(i)
    }
  }

  if (matchCount === 1) {
    return true
  }

  if (matchCount === 0) {
    addError(ctx, 'oneOf', 'Value does not match any schema in oneOf', instance, {
      schemas: oneOf.length,
    })
  } else {
    addError(ctx, 'oneOf', `Value matches ${matchCount} schemas in oneOf, expected exactly 1`, instance, {
      matchCount,
      matchingIndices,
    })
  }

  return false
}

/**
 * Validates 'not' keyword - schema must NOT match.
 */
export function validateNot(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const not = schema.not
  if (!not) {
    return true
  }

  const testCtx = createValidationContext(ctx.rootSchema)
  if (validateSchema(instance, not, testCtx)) {
    addError(ctx, 'not', 'Value should not match the schema in not', instance)
    return false
  }

  return true
}
```

### 5.7 Main Validation Function

```typescript
// src/validate/validate.ts

import type { Schema, ValidationResult, ValidationContext, ValidateOptions } from '../types'
import { createValidationContext } from './context'
import { resolveRef } from './resolve-ref'
import { validateType } from './keywords/type'
import { validateProperties, validateRequired, validateAdditionalProperties } from './keywords/properties'
import { validatePatternProperties } from './keywords/pattern-properties'
import { validateItems } from './keywords/items'
import { validateArrayBounds } from './keywords/array-bounds'
import { validateStringBounds } from './keywords/string-bounds'
import { validateNumberBounds } from './keywords/number-bounds'
import { validateEnum } from './keywords/enum'
import { validateAllOf, validateAnyOf, validateOneOf, validateNot } from './keywords/composition'
import { validateObjectBounds } from './keywords/object-bounds'
import { validateDependencies } from './keywords/dependencies'
import { validateFormat } from './keywords/format'

/**
 * Validates a value against a JSON Schema.
 *
 * @param instance - The value to validate
 * @param schema - The JSON Schema to validate against
 * @param options - Validation options
 * @returns Validation result with valid flag and errors array
 */
export function validate(instance: unknown, schema: Schema, options?: ValidateOptions): ValidationResult {
  const ctx = createValidationContext(schema)
  validateSchema(instance, schema, ctx)

  return {
    valid: ctx.errors.length === 0,
    errors: ctx.errors,
  }
}

/**
 * Internal recursive validation function.
 *
 * @param instance - Value to validate
 * @param schema - Schema to validate against
 * @param ctx - Validation context
 * @returns true if validation passed
 */
export function validateSchema(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, ctx)
    if (!resolved) {
      return true // Unresolvable refs pass (permissive)
    }
    return validateSchema(instance, resolved, ctx)
  }

  // Handle empty schema (accepts everything)
  if (Object.keys(schema).length === 0) {
    return true
  }

  let valid = true

  // Type validation
  valid = validateType(instance, schema, ctx) && valid

  // Composition keywords (apply regardless of type)
  valid = validateAllOf(instance, schema, ctx) && valid
  valid = validateAnyOf(instance, schema, ctx) && valid
  valid = validateOneOf(instance, schema, ctx) && valid
  valid = validateNot(instance, schema, ctx) && valid

  // Enum validation
  valid = validateEnum(instance, schema, ctx) && valid

  // Type-specific validation
  if (instance !== null && typeof instance === 'object') {
    if (Array.isArray(instance)) {
      // Array validations
      valid = validateItems(instance, schema, ctx) && valid
      valid = validateArrayBounds(instance, schema, ctx) && valid
    } else {
      // Object validations
      const obj = <Record<string, unknown>>instance
      valid = validateProperties(obj, schema, ctx) && valid
      valid = validateRequired(obj, schema, ctx) && valid
      valid = validatePatternProperties(obj, schema, ctx) && valid
      valid = validateAdditionalProperties(obj, schema, ctx) && valid
      valid = validateObjectBounds(obj, schema, ctx) && valid
      valid = validateDependencies(obj, schema, ctx) && valid
    }
  } else if (typeof instance === 'string') {
    valid = validateStringBounds(instance, schema, ctx) && valid
    valid = validateFormat(instance, schema, ctx) && valid
  } else if (typeof instance === 'number') {
    valid = validateNumberBounds(instance, schema, ctx) && valid
  }

  return valid
}
```

### 5.8 Validator Factory

````typescript
// src/validate/create-validator.ts

import type { Schema, ValidationResult, ValidateOptions } from '../types'
import { validate } from './validate'

/**
 * Creates a reusable validator function from a JSON Schema.
 * The returned function validates data against the pre-compiled schema.
 *
 * @param schema - JSON Schema to validate against
 * @param options - Default validation options
 * @returns Validator function that returns validation results
 *
 * @example
 * ```typescript
 * const schema = { type: 'object', properties: { name: { type: 'string' } } }
 * const validateUser = createValidator(schema)
 *
 * const result = validateUser({ name: 'Alice' })
 * console.log(result.valid) // true
 * ```
 */
export function createValidator(schema: Schema, options?: ValidateOptions): (data: unknown) => ValidationResult {
  return (data: unknown): ValidationResult => {
    return validate(data, schema, options)
  }
}
````

### 5.9 Schema Generation

````typescript
// src/generate/to-json-schema.ts

import type { Schema, JsonType } from '../types'
import { getJsonType } from './type-detection'
import { mergeSchemas } from './merge-schemas'

/**
 * Options for schema generation.
 */
export interface GenerateOptions {
  /** Array handling mode */
  arrays?: {
    /** How to generate schema for array items */
    mode: 'all' | 'first' | 'uniform' | 'tuple'
  }
  /** Whether to mark all object properties as required */
  required?: boolean
  /** additionalProperties setting for objects */
  additionalProperties?: boolean
}

const defaultOptions: Required<GenerateOptions> = {
  arrays: { mode: 'all' },
  required: false,
  additionalProperties: true,
}

/**
 * Generates a JSON Schema from a JavaScript value.
 *
 * @param value - The value to generate schema from
 * @param options - Generation options
 * @returns Generated JSON Schema
 *
 * @example
 * ```typescript
 * const schema = toJsonSchema({ name: 'Alice', age: 30 })
 * // { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } } }
 * ```
 */
export function toJsonSchema(value: unknown, options?: GenerateOptions): Schema {
  const opts = { ...defaultOptions, ...options }
  return generateSchema(value, opts)
}

function generateSchema(value: unknown, options: Required<GenerateOptions>): Schema {
  const type = getJsonType(value)

  switch (type) {
    case 'null':
      return { type: 'null' }
    case 'boolean':
      return { type: 'boolean' }
    case 'integer':
      return { type: 'integer' }
    case 'number':
      return { type: 'number' }
    case 'string':
      return { type: 'string' }
    case 'array':
      return generateArraySchema(<unknown[]>value, options)
    case 'object':
      return generateObjectSchema(<Record<string, unknown>>value, options)
    default:
      return {}
  }
}

function generateObjectSchema(obj: Record<string, unknown>, options: Required<GenerateOptions>): Schema {
  const keys = Object.keys(obj)

  if (keys.length === 0) {
    return { type: 'object' }
  }

  const properties: Record<string, Schema> = {}
  for (const key of keys) {
    properties[key] = generateSchema(obj[key], options)
  }

  const schema: Schema = {
    type: 'object',
    properties,
  }

  if (options.required) {
    schema.required = keys
  }

  if (!options.additionalProperties) {
    schema.additionalProperties = false
  }

  return schema
}

function generateArraySchema(arr: unknown[], options: Required<GenerateOptions>): Schema {
  if (arr.length === 0) {
    return { type: 'array' }
  }

  const schema: Schema = { type: 'array' }
  const mode = options.arrays.mode

  switch (mode) {
    case 'first':
      schema.items = generateSchema(arr[0], options)
      break

    case 'tuple':
      schema.items = arr.map((item) => generateSchema(item, options))
      break

    case 'uniform': {
      const itemSchemas = arr.map((item) => generateSchema(item, options))
      const first = itemSchemas[0]
      const allSame = itemSchemas.every((s) => schemasEqual(s, <Schema>first))
      if (allSame && first) {
        schema.items = first
      } else {
        // Fall back to tuple for non-uniform arrays
        schema.items = itemSchemas
      }
      break
    }

    case 'all':
    default: {
      const itemSchemas = arr.map((item) => generateSchema(item, options))
      schema.items = mergeSchemas(itemSchemas)
      break
    }
  }

  return schema
}

function schemasEqual(a: Schema, b: Schema): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
````

### 5.10 Schema Merging

```typescript
// src/generate/merge-schemas.ts

import type { Schema, JsonType } from '../types'

/**
 * Merges multiple schemas into a single unified schema.
 * Used for array items when mode is 'all'.
 *
 * @param schemas - Array of schemas to merge
 * @returns Merged schema
 */
export function mergeSchemas(schemas: Schema[]): Schema {
  if (schemas.length === 0) {
    return {}
  }

  if (schemas.length === 1 && schemas[0]) {
    return schemas[0]
  }

  // Collect all types
  const types = new Set<JsonType>()
  const allProperties: Map<string, Schema[]> = new Map()
  let hasObject = false
  let hasArray = false
  let itemSchemas: Schema[] = []

  for (const schema of schemas) {
    if (!schema) continue

    // Collect types
    if (schema.type) {
      const schemaTypes = Array.isArray(schema.type) ? schema.type : [schema.type]
      for (const type of schemaTypes) {
        // Coerce integer to number for merging
        if (type === 'integer') {
          types.add('number')
        } else {
          types.add(type)
        }
      }
    }

    // Collect object properties
    if (schema.type === 'object' && schema.properties) {
      hasObject = true
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const existing = allProperties.get(key) || []
        existing.push(propSchema)
        allProperties.set(key, existing)
      }
    }

    // Collect array items
    if (schema.type === 'array' && schema.items && !Array.isArray(schema.items)) {
      hasArray = true
      itemSchemas.push(schema.items)
    }
  }

  // Build merged schema
  const merged: Schema = {}

  // Handle types
  const typeArray = Array.from(types)
  if (typeArray.length === 1 && typeArray[0]) {
    merged.type = typeArray[0]
  } else if (typeArray.length > 1) {
    merged.type = typeArray
  }

  // Merge object properties
  if (hasObject && allProperties.size > 0) {
    merged.properties = {}
    for (const [key, propSchemas] of allProperties) {
      merged.properties[key] = mergeSchemas(propSchemas)
    }
  }

  // Merge array items
  if (hasArray && itemSchemas.length > 0) {
    merged.items = mergeSchemas(itemSchemas)
  }

  return merged
}
```

---

## Part 6: Additional Keywords Implementation

### 6.1 String Bounds

```typescript
// src/validate/keywords/string-bounds.ts

import type { Schema, ValidationContext } from '../../types'
import { addError } from '../context'

/**
 * Validates string length and pattern constraints.
 */
export function validateStringBounds(instance: string, schema: Schema, ctx: ValidationContext): boolean {
  let valid = true

  // minLength
  if (schema.minLength !== undefined && instance.length < schema.minLength) {
    addError(ctx, 'minLength', `String length ${instance.length} is less than minimum ${schema.minLength}`, instance, {
      minLength: schema.minLength,
      actual: instance.length,
    })
    valid = false
  }

  // maxLength
  if (schema.maxLength !== undefined && instance.length > schema.maxLength) {
    addError(ctx, 'maxLength', `String length ${instance.length} is greater than maximum ${schema.maxLength}`, instance, {
      maxLength: schema.maxLength,
      actual: instance.length,
    })
    valid = false
  }

  // pattern
  if (schema.pattern !== undefined) {
    try {
      const regex = new RegExp(schema.pattern)
      if (!regex.test(instance)) {
        addError(ctx, 'pattern', `String does not match pattern '${schema.pattern}'`, instance, {
          pattern: schema.pattern,
        })
        valid = false
      }
    } catch {
      // Invalid regex - skip validation
    }
  }

  return valid
}
```

### 6.2 Number Bounds

```typescript
// src/validate/keywords/number-bounds.ts

import type { Schema, ValidationContext } from '../../types'
import { addError } from '../context'

/**
 * Validates number range and multipleOf constraints.
 */
export function validateNumberBounds(instance: number, schema: Schema, ctx: ValidationContext): boolean {
  let valid = true

  // minimum (Draft 4 style with exclusiveMinimum as boolean)
  if (schema.minimum !== undefined) {
    const exclusive = schema.exclusiveMinimum === true
    if (exclusive ? instance <= schema.minimum : instance < schema.minimum) {
      const op = exclusive ? '>' : '>='
      addError(ctx, 'minimum', `Value ${instance} must be ${op} ${schema.minimum}`, instance, { minimum: schema.minimum, exclusive })
      valid = false
    }
  }

  // maximum (Draft 4 style with exclusiveMaximum as boolean)
  if (schema.maximum !== undefined) {
    const exclusive = schema.exclusiveMaximum === true
    if (exclusive ? instance >= schema.maximum : instance > schema.maximum) {
      const op = exclusive ? '<' : '<='
      addError(ctx, 'maximum', `Value ${instance} must be ${op} ${schema.maximum}`, instance, { maximum: schema.maximum, exclusive })
      valid = false
    }
  }

  // multipleOf
  if (schema.multipleOf !== undefined && schema.multipleOf > 0) {
    // Use remainder with tolerance for floating point errors
    const remainder = instance % schema.multipleOf
    const tolerance = 1e-10
    if (Math.abs(remainder) > tolerance && Math.abs(remainder - schema.multipleOf) > tolerance) {
      addError(ctx, 'multipleOf', `Value ${instance} is not a multiple of ${schema.multipleOf}`, instance, {
        multipleOf: schema.multipleOf,
      })
      valid = false
    }
  }

  return valid
}
```

### 6.3 Enum Keyword

```typescript
// src/validate/keywords/enum.ts

import type { Schema, ValidationContext } from '../../types'
import { addError } from '../context'
import { isIdentical } from '@hyperfrontend/data-utils'

/**
 * Validates enum constraint.
 */
export function validateEnum(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.enum) {
    return true
  }

  for (const value of schema.enum) {
    if (isIdentical(instance, value)) {
      return true
    }
  }

  addError(ctx, 'enum', `Value must be one of: ${JSON.stringify(schema.enum)}`, instance, {
    allowedValues: schema.enum,
  })

  return false
}
```

### 6.4 Array Bounds

```typescript
// src/validate/keywords/array-bounds.ts

import type { Schema, ValidationContext } from '../../types'
import { addError } from '../context'
import { isIdentical } from '@hyperfrontend/data-utils'

/**
 * Validates array length and uniqueItems constraints.
 */
export function validateArrayBounds(instance: unknown[], schema: Schema, ctx: ValidationContext): boolean {
  let valid = true

  // minItems
  if (schema.minItems !== undefined && instance.length < schema.minItems) {
    addError(ctx, 'minItems', `Array has ${instance.length} items, minimum is ${schema.minItems}`, instance, {
      minItems: schema.minItems,
      actual: instance.length,
    })
    valid = false
  }

  // maxItems
  if (schema.maxItems !== undefined && instance.length > schema.maxItems) {
    addError(ctx, 'maxItems', `Array has ${instance.length} items, maximum is ${schema.maxItems}`, instance, {
      maxItems: schema.maxItems,
      actual: instance.length,
    })
    valid = false
  }

  // uniqueItems
  if (schema.uniqueItems === true) {
    for (let i = 0; i < instance.length; i++) {
      for (let j = i + 1; j < instance.length; j++) {
        if (isIdentical(instance[i], instance[j])) {
          addError(ctx, 'uniqueItems', `Array items at index ${i} and ${j} are identical`, instance, {
            indices: [i, j],
          })
          valid = false
          break
        }
      }
    }
  }

  return valid
}
```

### 6.5 Format Keyword

```typescript
// src/validate/keywords/format.ts

import type { Schema, ValidationContext } from '../../types'
import { addError } from '../context'

/**
 * Format validators for common string formats.
 */
const formatValidators: Record<string, (value: string) => boolean> = {
  'date-time': (v) => !isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v),
  date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
  time: (v) => /^\d{2}:\d{2}:\d{2}/.test(v),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  uri: (v) => {
    try {
      new URL(v)
      return true
    } catch {
      return false
    }
  },
  'uri-reference': (v) => {
    try {
      new URL(v, 'http://example.com')
      return true
    } catch {
      return false
    }
  },
  uuid: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  hostname: (v) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(v),
  ipv4: (v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) && v.split('.').every((n) => parseInt(n, 10) <= 255),
  ipv6: (v) => /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i.test(v),
  regex: (v) => {
    try {
      new RegExp(v)
      return true
    } catch {
      return false
    }
  },
  'json-pointer': (v) => v === '' || /^\/([^/~]|~[01])*$/.test(v),
}

/**
 * Validates string format constraint.
 */
export function validateFormat(instance: string, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.format) {
    return true
  }

  const validator = formatValidators[schema.format]

  // Unknown formats pass validation (per spec)
  if (!validator) {
    return true
  }

  if (!validator(instance)) {
    addError(ctx, 'format', `String does not match format '${schema.format}'`, instance, {
      format: schema.format,
    })
    return false
  }

  return true
}
```

---

## Part 7: Migration Guide

### 7.1 Before Migration

```typescript
// Current usage in network-protocol
import { Validator } from 'jsonschema'
import type { Schema } from 'jsonschema'
import toJsonSchema from 'to-json-schema'

const validator = new Validator()
const result = validator.validate(data, schema)
const generatedSchema = toJsonSchema(data, { arrays: { mode: 'all' } })
```

### 7.2 After Migration

```typescript
// New usage with internal library
import { validate, toJsonSchema } from '@hyperfrontend/json-utils'
import type { Schema } from '@hyperfrontend/json-utils'

const result = validate(data, schema)
const generatedSchema = toJsonSchema(data, { arrays: { mode: 'all' } })
```

### 7.3 API Mapping

| Original (`jsonschema`)                  | New (`@hyperfrontend/json-utils`) | Notes               |
| ---------------------------------------- | --------------------------------- | ------------------- |
| `new Validator().validate(data, schema)` | `validate(data, schema)`          | Functional API      |
| `result.errors[i].property`              | `result.errors[i].path`           | JSON Pointer format |
| `result.errors[i].instance`              | `result.errors[i].instance`       | Same                |
| `Schema` type                            | `Schema` type                     | Compatible          |

| Original (`to-json-schema`) | New                        | Notes          |
| --------------------------- | -------------------------- | -------------- |
| `toJsonSchema(data, opts)`  | `toJsonSchema(data, opts)` | Same signature |

---

## Part 8: Porting Checklist

### 8.1 From `jsonschema` v1.5.0

**Must Port:**

- [ ] `Validator.validate()` - Main validation entry point
- [ ] `ValidatorResult` → `ValidationResult` - Result structure
- [ ] `ValidationError` - Error structure (adapt property → path)
- [ ] Type keyword validation (`type`)
- [ ] Object keywords (`properties`, `required`, `additionalProperties`, `patternProperties`)
- [ ] Array keywords (`items`, `additionalItems`, `minItems`, `maxItems`, `uniqueItems`)
- [ ] String keywords (`minLength`, `maxLength`, `pattern`)
- [ ] Number keywords (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`)
- [ ] Composition keywords (`allOf`, `anyOf`, `oneOf`, `not`)
- [ ] Enum keyword (`enum`)
- [ ] Reference resolution (`$ref`, `definitions`)
- [ ] Object bounds (`minProperties`, `maxProperties`, `dependencies`)
- [ ] Format validation (common formats)

**Do Not Port:**

- [ ] Complex $ref resolution (external URIs)
- [ ] `throwError` option
- [ ] `rewrite` option
- [ ] `propertyName` option
- [ ] Schema caching/indexing (simplify)
- [ ] Custom type coercion
- [ ] Meta-schema loading
- [ ] Remote schema fetching

### 8.2 From `to-json-schema` v0.2.5

**Must Port:**

- [ ] `toJsonSchema()` - Main generation function
- [ ] Type detection for primitives
- [ ] Object schema generation with properties
- [ ] Array schema generation with `mode: 'all'` (merging)
- [ ] Schema merging logic

**Do Not Port:**

- [ ] `mode: 'tuple'` - Not used
- [ ] `mode: 'uniform'` - Not used (but simple, may include)
- [ ] String format detection - Not used
- [ ] Custom type handlers - Not used
- [ ] lodash dependencies - Reimplement without

### 8.3 Files to Modify After Implementation

#### network-protocol

| File                                                         | Change                          |
| ------------------------------------------------------------ | ------------------------------- |
| `src/lib/data/validations/is-valid-schema.ts`                | Update import, use `validate()` |
| `src/lib/data/validations/is-valid-schema.spec.ts`           | Update import                   |
| `src/lib/data/validations/is-valid-unencrypted-data.spec.ts` | Update import                   |
| `src/lib/data/creators/get-schema.ts`                        | Update import                   |
| `src/lib/data/creators/create-data-factory.ts`               | Update import                   |
| `src/lib/data/model.ts`                                      | Update import                   |

#### nexus

| File                                      | Change                     |
| ----------------------------------------- | -------------------------- |
| `src/schema/validate/create-validator.ts` | Update import, use factory |
| `src/schema/validate/contract.ts`         | Update import              |
| `src/schema/validate/action.ts`           | Update import              |
| `src/schema/validate/message.ts`          | Update import              |
| Various spec files                        | Update imports             |

---

## Part 9: Testing Strategy

### 9.1 Test Categories

1. **Unit tests** - Individual keyword validators
2. **Integration tests** - Full validation/generation flows
3. **Compatibility tests** - Ensure output matches original behavior
4. **Edge case tests** - Boundary conditions, error messages

### 9.2 Compatibility Test Approach

```typescript
// Compare results between original and new implementation
describe('Compatibility', () => {
  const schemas = [
    { type: 'string' },
    { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
    { type: 'array', items: { type: 'number' }, minItems: 1 },
    { anyOf: [{ type: 'string' }, { type: 'number' }] },
    // ... comprehensive schema examples
  ]

  const instances = [
    'hello',
    123,
    { a: 'test' },
    [1, 2, 3],
    null,
    // ... various test values
  ]

  for (const schema of schemas) {
    for (const instance of instances) {
      it(`validates ${JSON.stringify(instance)} against ${JSON.stringify(schema)}`, () => {
        const ourResult = validate(instance, schema)
        const originalResult = new OriginalValidator().validate(instance, schema)
        expect(ourResult.valid).toBe(originalResult.valid)
      })
    }
  }
})
```

---

## Part 10: Success Criteria

### 10.1 Definition of Done

- [ ] `libs/utils/json` library created following project patterns
- [ ] All public APIs documented with JSDoc
- [ ] All keyword validators implemented and tested
- [ ] Schema generation implemented and tested
- [ ] All existing tests in `network-protocol` passing
- [ ] All existing tests in `nexus` passing
- [ ] `jsonschema` removed from `package.json`
- [ ] `to-json-schema` removed from `package.json`
- [ ] `@types/to-json-schema` removed from `package.json`
- [ ] Path alias added to `tsconfig.base.json`
- [ ] Build succeeds with no warnings

### 10.2 Performance Criteria

- Validation speed within 2x of original
- Bundle size smaller than combined originals (~30KB gzip)
- No significant memory overhead

---

## Part 11: Implementation Order

### Phase 1: Foundation

1. Create library scaffold (`npx nx g @nx/js:library json --directory=libs/utils/json`)
2. Define types (`Schema`, `ValidationResult`, `ValidationError`)
3. Implement core context utilities
4. Implement `$ref` resolution

### Phase 2: Core Validation

1. Implement `type` keyword
2. Implement object keywords (`properties`, `required`, `additionalProperties`)
3. Implement array keywords (`items`, `minItems`, `maxItems`)
4. Implement string keywords (`minLength`, `maxLength`, `pattern`)
5. Implement number keywords (`minimum`, `maximum`, `multipleOf`)

### Phase 3: Advanced Validation

1. Implement composition (`allOf`, `anyOf`, `oneOf`, `not`)
2. Implement `enum` keyword
3. Implement `patternProperties`
4. Implement `uniqueItems`
5. Implement `dependencies`
6. Implement `format` validators
7. Implement object bounds (`minProperties`, `maxProperties`)

### Phase 4: Schema Generation

1. Implement type detection
2. Implement primitive schema generation
3. Implement object schema generation
4. Implement array schema generation with merging

### Phase 5: Integration

1. Update imports in `network-protocol`
2. Update imports in `nexus`
3. Run all tests
4. Remove external dependencies
5. Update `tsconfig.base.json`
