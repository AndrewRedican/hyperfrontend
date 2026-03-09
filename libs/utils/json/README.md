# @hyperfrontend/json-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-json-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-json-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=json-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=json-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/json-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/json-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/json-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fjson-utils?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/json-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/json-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Zero-dependency JSON Schema Draft v4 validation and schema generation utilities.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/json/)

## What is @hyperfrontend/json-utils?

@hyperfrontend/json-utils provides lightweight utilities for validating JSON data against JSON Schema Draft v4 specifications and generating schemas from JavaScript values via a functional-programming-first implementation.

The library provides two core capabilities: **validation** (checking if data conforms to a schema) and **generation** (creating a schema from sample data). Both functions use pure functional design with no side effects, making them predictable and easy to test.

### Key Features

- **Full JSON Schema Draft v4 Support** - Validates `type`, `properties`, `required`, `items`, `enum`, `pattern`, `minimum`/`maximum`, `allOf`/`anyOf`/`oneOf`/`not`, `$ref`, `format`, and more
- **Schema Generation** - Create schemas from sample data with configurable array handling modes
- **Reusable Validators** - Create validator functions once, reuse them efficiently
- **Detailed Error Messages** - Get precise error paths, messages, and codes for failed validations
- **Zero External Dependencies** - Self-contained implementation with no third-party runtime dependencies
- **Isomorphic Design** - Works identically in Node.js and browser environments

### What This Library Does NOT Support

- **JSON Schema Draft 6, 7, 2019-09, or 2020-12** - Only Draft v4 is implemented
- **External `$ref` Resolution** - Only internal references (`#/definitions/...`) are supported; no HTTP or file-based schema loading
- **`const`, `contains`, `propertyNames`, `if/then/else`** - These are Draft 6+ features
- **Custom Format Validators** - Built-in formats only (`email`, `uri`, `date-time`, etc.)

If you need full JSON Schema support across multiple draft versions, consider [Ajv](https://ajv.js.org/). This library is intentionally scoped for Draft v4 use cases where a lightweight, zero-dependency solution is preferred.

## Why Use @hyperfrontend/json-utils?

### Validate User-Provided Schemas

When your application accepts user-defined JSON Schema (like contract definitions or API specifications), you need reliable validation. This library validates both the data and can verify that schemas themselves are valid Draft v4 documents using the meta-schema.

### Generate Schemas from Sample Data

Instead of manually writing schemas for data structures, generate them from representative samples. Useful for testing, documentation generation, and bootstrap schema creation.

### Functional Programming Approach

All functions are pure with no side effects. Create validator functions with `createValidator()` and reuse them without worrying about shared state. Validation contexts are immutable and composable.

## Installation

```bash
npm install @hyperfrontend/json-utils
```

## Quick Start

### Validate Data Against a Schema

```typescript
import { validate } from '@hyperfrontend/json-utils'
import type { Schema } from '@hyperfrontend/json-utils'

const schema: Schema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    age: { type: 'integer', minimum: 0 },
    email: { type: 'string', format: 'email' },
  },
  required: ['name', 'email'],
}

const result = validate({ name: 'Alice', email: 'alice@example.com' }, schema)
console.log(result.valid) // true

const invalid = validate({ name: '', age: -5 }, schema)
console.log(invalid.valid) // false
console.log(invalid.errors)
// [
//   { message: 'Missing required property: email', path: '/', code: 'required' },
//   { message: 'String must be at least 1 characters, got 0', path: '/name', code: 'minLength' },
//   { message: 'Number must be at least 0, got -5', path: '/age', code: 'minimum' }
// ]
```

### Create Reusable Validators

```typescript
import { createValidator } from '@hyperfrontend/json-utils'

const validateUser = createValidator({
  type: 'object',
  properties: {
    id: { type: 'integer' },
    username: { type: 'string', pattern: '^[a-z0-9_]+$' },
  },
  required: ['id', 'username'],
})

// Reuse without re-parsing schema
validateUser({ id: 1, username: 'alice' }) // { valid: true, errors: [] }
validateUser({ id: 'bad' }) // { valid: false, errors: [...] }
```

### Generate Schemas from Data

```typescript
import { toJsonSchema } from '@hyperfrontend/json-utils'

const data = {
  users: [
    { name: 'Alice', active: true },
    { name: 'Bob', active: false },
  ],
  metadata: { version: '1.0' },
}

const schema = toJsonSchema(data)
// {
//   type: 'object',
//   properties: {
//     users: {
//       type: 'array',
//       items: {
//         type: 'object',
//         properties: {
//           name: { type: 'string' },
//           active: { type: 'boolean' }
//         },
//         required: ['name', 'active']
//       }
//     },
//     metadata: {
//       type: 'object',
//       properties: { version: { type: 'string' } },
//       required: ['version']
//     }
//   },
//   required: ['users', 'metadata']
// }
```

### Use $ref for Reusable Definitions

```typescript
import { validate } from '@hyperfrontend/json-utils'

const schema = {
  definitions: {
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
      },
      required: ['street', 'city'],
    },
  },
  type: 'object',
  properties: {
    home: { $ref: '#/definitions/address' },
    work: { $ref: '#/definitions/address' },
  },
}

validate(
  {
    home: { street: '123 Main', city: 'Boston' },
    work: { street: '456 Oak', city: 'Cambridge' },
  },
  schema
) // { valid: true, errors: [] }
```

## API Overview

### Validation

- **`validate(instance, schema, options?): ValidationResult`** - Validate a value against a JSON Schema
- **`createValidator(schema, options?): (data) => ValidationResult`** - Create a reusable validator function

### Generation

- **`toJsonSchema(value, options?): Schema`** - Generate a JSON Schema from a JavaScript value

### Utilities

- **`getJsonType(value): JsonType`** - Get the JSON Schema type of a JavaScript value
- **`isEqual(a, b): boolean`** - Deep equality comparison for JSON values
- **`checkPatternSafety(pattern): PatternSafetyResult`** - Check if a regex pattern may cause ReDoS

### Types

- **`Schema`** - TypeScript interface representing JSON Schema Draft v4
- **`JsonType`** - `'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'`
- **`ValidationResult`** - `{ valid: boolean, errors: ValidationError[] }`
- **`ValidationError`** - `{ message: string, path: string, code?: string, instance?: unknown, params?: object }`
- **`ValidateOptions`** - Validation configuration (see below)
- **`GenerateOptions`** - `{ arrays?: { mode: 'all' | 'first' | 'uniform' }, includeRequired?: boolean }`
- **`PatternSafetyChecker`** - Custom function for ReDoS pattern detection
- **`PatternSafetyResult`** - `{ safe: boolean, reason?: string }`

### ValidateOptions

| Option             | Type                              | Default | Description                                              |
| ------------------ | --------------------------------- | ------- | -------------------------------------------------------- |
| `collectAllErrors` | `boolean`                         | `true`  | When `false`, stops at first error                       |
| `strictPatterns`   | `boolean`                         | `false` | Report errors for invalid regex patterns (syntax errors) |
| `safePatterns`     | `boolean \| PatternSafetyChecker` | `false` | Enable ReDoS protection (see Security section)           |

## Security: ReDoS Protection

JSON Schema's `pattern` and `patternProperties` keywords accept arbitrary regex patterns. Malicious or poorly-crafted patterns can cause [ReDoS (Regular Expression Denial of Service)](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) attacks with exponential backtracking.

### Built-in Heuristics

Enable built-in ReDoS detection with `safePatterns: true`:

```typescript
import { validate } from '@hyperfrontend/json-utils'

const schema = { type: 'string', pattern: '(a+)+' } // Known ReDoS pattern

const result = validate('aaa', schema, { safePatterns: true })
// result.valid = false
// result.errors[0].message = 'Unsafe regex pattern: Nested quantifiers detected...'
```

The built-in checker detects common dangerous patterns:

- Nested quantifiers: `(a+)+`, `(a*)*`, `([a-z]+)+`
- Overlapping alternations: `(a|a)+`
- Multiple unbounded wildcards: `.*.*`
- Extremely large quantifier bounds: `a{1,100000}`

### Custom Checker (Recommended for Production)

For comprehensive protection, provide a custom checker using [safe-regex2](https://www.npmjs.com/package/safe-regex2):

```typescript
import { validate, type PatternSafetyChecker } from '@hyperfrontend/json-utils'
import safeRegex from 'safe-regex2'

const checker: PatternSafetyChecker = (pattern) => ({
  safe: safeRegex(pattern),
  reason: 'Pattern may cause catastrophic backtracking',
})

validate(data, schema, { safePatterns: checker })
```

### Exported Utilities

```typescript
import { checkPatternSafety } from '@hyperfrontend/json-utils'

// Use built-in heuristics directly
const result = checkPatternSafety('(a+)+')
// { safe: false, reason: 'Nested quantifiers detected...' }
```

### Supported Keywords

| Category    | Keywords                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Type        | `type`                                                                                                                    |
| Object      | `properties`, `required`, `additionalProperties`, `patternProperties`, `minProperties`, `maxProperties`, `dependencies`   |
| Array       | `items`, `additionalItems`, `minItems`, `maxItems`, `uniqueItems`                                                         |
| String      | `minLength`, `maxLength`, `pattern`, `format`                                                                             |
| Number      | `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`                                                |
| Composition | `allOf`, `anyOf`, `oneOf`, `not`                                                                                          |
| Reference   | `$ref`, `definitions`                                                                                                     |
| Enum        | `enum`                                                                                                                    |
| Format      | `email`, `uri`, `uri-reference`, `date-time`, `date`, `time`, `hostname`, `ipv4`, `ipv6`, `uuid`, `regex`, `json-pointer` |

## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/json-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/json-utils"></script>

<script>
  const { validate, toJsonSchema } = HyperfrontendJsonUtils
</script>
```

**Global variable:** `HyperfrontendJsonUtils`

### Dependencies

None — zero external dependencies.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/json)**

## License

MIT
