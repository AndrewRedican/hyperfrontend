# lib-require-jsdoc-example-label

Require @example JSDoc tags to have descriptive labels in publishable libraries for documentation clarity.

## Rule Details

This rule enforces that all `@example` blocks in JSDoc comments include a descriptive label on the same line. Labels help readers quickly understand what each example demonstrates without reading the code.

### Applies To

- **Publishable libraries only**: Libraries with `projectType: 'library'` and both `build` and `publish` targets in `project.json`
- **Exported functions**: Named and default exports
- **Exported arrow functions**: `export const fn = () => {}`
- **Exported function expressions**: `export const fn = function() {}`
- **Exported classes**: Named and default exports

### Exemptions

- **JSDoc without @example**: This rule only checks existing examples; use `lib-require-jsdoc-example` to require examples
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
 * @example
 * add(1, 2) // => 3
 */
export function add(a: number, b: number): number {
  return a + b
}
```

````typescript
/**
 * Fetches user data.
 *
 * @example
 * ```typescript
 * fetchUser(123)
 * ```
 */
export function fetchUser(id: number): object {
  return { id }
}
````

```typescript
/**
 * Multiple examples, one missing label.
 *
 * @example Basic usage
 * multiply(2, 3)
 *
 * @example
 * multiply(10, 5)
 */
export const multiply = (a: number, b: number) => a * b
```

### ✅ Correct

```typescript
/**
 * Adds two numbers.
 *
 * @example Basic addition
 * add(1, 2) // => 3
 */
export function add(a: number, b: number): number {
  return a + b
}
```

````typescript
/**
 * Fetches user data.
 *
 * @example Fetching by ID
 * ```typescript
 * fetchUser(123)
 * ```
 */
export function fetchUser(id: number): object {
  return { id }
}
````

```typescript
/**
 * Multiplies values with multiple examples.
 *
 * @example Basic multiplication
 * multiply(2, 3)
 *
 * @example Large numbers
 * multiply(10, 5)
 */
export const multiply = (a: number, b: number) => a * b
```

### Types and interfaces are exempt

```typescript
// Valid - no @example required for types
/**
 * Configuration options.
 */
export type Config = {
  value: string
}
```

## When Not To Use It

If your library's examples are self-explanatory from the code alone, or if you prefer unlabeled examples, you can disable this rule. Consider using `lib-require-jsdoc-example` independently to still require examples without enforcing labels.

## Related Rules

- [lib-require-jsdoc-example](./lib-require-jsdoc-example.md) - Requires @example blocks on exported APIs
