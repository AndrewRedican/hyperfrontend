# lib-require-jsdoc-example

Require @example JSDoc tag on exported functions and classes in publishable libraries for documentation quality.

## Rule Details

This rule enforces that all exported functions, arrow functions, function expressions, and classes in publishable libraries include an `@example` block in their JSDoc comments. Examples improve documentation quality and help users understand usage patterns.

### Applies To

- **Publishable libraries only**: Libraries with `projectType: 'library'` and both `build` and `publish` targets in `project.json`
- **Exported functions**: Named and default exports
- **Exported arrow functions**: `export const fn = () => {}`
- **Exported function expressions**: `export const fn = function() {}`
- **Exported classes**: Named and default exports

### Exemptions

- **Type aliases** (`type Foo = ...`)
- **Interfaces** (`interface Foo { ... }`)
- **Non-exported declarations**: Internal functions and classes
- **Non-publishable libraries**: Applications, internal libraries, or libraries without publish targets

## Examples

### ❌ Incorrect

```typescript
/**
 * Adds two numbers.
 *
 * @param a - First number
 * @param b - Second number
 * @returns The sum
 */
export function add(a: number, b: number): number {
  return a + b
}
```

```typescript
/**
 * A helper class.
 */
export class Helper {}
```

```typescript
/**
 * Multiply values.
 */
export const multiply = (a: number, b: number) => a * b
```

### ✅ Correct

```typescript
/**
 * Adds two numbers.
 *
 * @param a - First number
 * @param b - Second number
 * @returns The sum
 *
 * @example
 * add(1, 2) // => 3
 */
export function add(a: number, b: number): number {
  return a + b
}
```

```typescript
/**
 * A helper class for string operations.
 *
 * @example
 * const helper = new Helper()
 * helper.format('hello')
 */
export class Helper {
  format(value: string): string {
    return value.toUpperCase()
  }
}
```

```typescript
/**
 * Multiply values.
 *
 * @example
 * multiply(2, 3) // => 6
 */
export const multiply = (a: number, b: number) => a * b
```

### Types and interfaces are exempt

```typescript
/**
 * Configuration options for the library.
 */
export interface Config {
  timeout: number
  retries: number
}

/**
 * Result type for operations.
 */
export type Result<T> = { success: true; data: T } | { success: false; error: Error }
```

## When Not To Use It

This rule is designed for publishable npm packages where documentation quality matters. You may disable it if:

- Your library is internal and doesn't need extensive documentation
- You have alternative documentation practices

## Related

- [jsdoc/require-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc#require-jsdoc) - Requires JSDoc on declarations
- [lib-readme-structure](./lib-readme-structure.md) - Enforces README structure for publishable libraries
