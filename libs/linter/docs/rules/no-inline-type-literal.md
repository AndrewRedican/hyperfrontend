# no-inline-type-literal

Forbid anonymous object types with named members at use sites; declare the shape as a named type alias or interface.

## Rule Details

An object type written inline, such as `{ a: number; b: string }` in a parameter annotation, is not a declaration, so it cannot carry JSDoc, cannot be imported or extended, and does not show up in an editor's symbol search. A change to the shape has to be repeated wherever the literal was copied. The rule reports every object type literal with at least one property or method member, wherever it sits: parameter and return annotations, variable and class property annotations, type assertions and `satisfies`, type arguments, unions and intersections, generic constraints, and literals nested inside a type alias. The rule does not fix.

Exempt are the literal that is the whole right-hand side of a `type` alias (the place a shape is named), an interface body, the empty type `{}`, and literals holding only index signatures (`{ [key: string]: T }`) or call signatures (`{ (): void }`), which have no named members to document.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function start({ logger }: { logger: Logger }): void {}

function check(): { ok: boolean } {
  return { ok: true }
}

const m: Map<string, { a: number }> = new Map()

type Union = string | { a: number }

type Outer = { inner: { a: number } }
```

### ✅ Correct

```ts
type StartOptions = { logger: Logger }
function start({ logger }: StartOptions): void {}

interface CheckResult {
  ok: boolean
}
function check(): CheckResult {
  return { ok: true }
}

type Inner = { a: number }
type Outer = { inner: Inner }

const empty: {} = {}
const counts: { [key: string]: number } = {}
```
