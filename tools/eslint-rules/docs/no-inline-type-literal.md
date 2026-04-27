# no-inline-type-literal

Prohibit inline anonymous object type literals at use sites. Require a named `type` alias or `interface` so JSDoc can be attached and the shape can be reused.

## Rule Details

Object type literals (`{ a: number; b: string }`) declared at use sites cannot have JSDoc attached to them — they are not declarations. The repository's JSDoc-injecting rule cannot decorate them, so the convention is to extract every named-property shape into a `type` alias or `interface` and reference it by name.

This rule flags any `TSTypeLiteral` with at least one `TSPropertySignature` or `TSMethodSignature` member, except when it is the immediate right-hand side of a `type` alias declaration. Nesting a literal inside a type alias is also flagged — every shape needs its own name.

### Why?

- **Documentability.** Only declarations can carry JSDoc. Inline shapes route around the JSDoc-coverage rules.
- **Reusability.** Named types can be imported, extended, and combined. Inline shapes cannot.
- **Discoverability.** A named type appears in editor symbol search; an inline shape does not.
- **Refactor safety.** Shape changes localize to one declaration instead of many duplicated literals.

### What is exempt

- The immediate RHS of `type X = { ... }` (the canonical naming site).
- The body of `interface X { ... }` (a different AST node, never matches).
- Empty `{}` — semantically "any non-nullish," not a shape.
- Index-signature-only literals like `{ [k: string]: T }` — no per-property names to document; use `Record<string, T>` if a name is desired.
- Pure call-signature literals like `{ (): void }` — no named members.

## Examples

### ❌ Incorrect

```typescript
function a({ logger, other }: { logger: Logger; other: number }) {
  /* ... */
}

function f(): { etc: boolean } {
  /* ... */
}

const x: { a: number } = { a: 1 }

class C {
  x: { a: number } = { a: 1 }
}

const something = <{ etc: boolean }>getSomething()
const other = getSomething() as { etc: boolean }

const r = useState<{ a: number }>()
const m: Map<string, { a: number }> = new Map()

type U = string | { a: number }
type I = Base & { a: number }

const v = data satisfies { a: number }

function gen<T extends { a: number }>(x: T): T {
  return x
}

type Outer = { inner: { a: number } }
```

### ✅ Correct

```typescript
type LoggerProps = { logger: Logger; other: number }
function a({ logger, other }: LoggerProps) {
  /* ... */
}

type EtcResult = { etc: boolean }
function f(): EtcResult {
  /* ... */
}

interface Position {
  a: number
}
const x: Position = { a: 1 }

const something = <EtcResult>getSomething()

const r = useState<Position>()
const m: Map<string, Position> = new Map()

type U = string | Position
type I = Base & Position

const v = data satisfies Position

function gen<T extends Position>(x: T): T {
  return x
}

type Inner = { a: number }
type Outer = { inner: Inner }

const empty: {} = {}
const dict: { [k: string]: number } = {}
```

## Related Rules

- [prefer-angle-bracket-assertion](./prefer-angle-bracket-assertion.md)
- [no-mixed-type-import](./no-mixed-type-import.md)
