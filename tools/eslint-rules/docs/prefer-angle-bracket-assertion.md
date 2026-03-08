# prefer-angle-bracket-assertion

Enforce angle bracket syntax (`<T>value`) over `as` syntax (`value as T`) for type assertions.

## Rule Details

This rule requires using angle bracket syntax for type assertions instead of the `as` keyword.

### Why?

- **Consistency**: One style throughout the codebase
- **Clarity**: Angle brackets place the type before the value, matching declaration syntax
- **Tradition**: Angle brackets are the original TypeScript assertion syntax

## Examples

### ❌ Incorrect

```typescript
const element = document.getElementById('app') as HTMLDivElement
const data = response as ApiResponse
const num = value as number
```

### ✅ Correct

```typescript
const element = <HTMLDivElement>document.getElementById('app')
const data = <ApiResponse>response
const num = <number>value
```

## Caveats

Angle bracket assertions cannot be used in `.tsx` files because they conflict with JSX syntax. This rule should only be applied to `.ts` files.

## When Not To Use It

- In `.tsx` files (JSX conflicts with angle brackets)
- If your team prefers the `as` syntax for readability
- In mixed React/non-React codebases for consistency

## Related Rules

- [no-mixed-type-import](./no-mixed-type-import.md)
