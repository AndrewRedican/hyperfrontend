# prefer-jsdoc-over-trailing-comments

Prefer JSDoc comments above members over trailing inline comments.

## Rule Details

This rule flags trailing `//` comments placed after properties, method signatures, or other interface/class/type members. Instead, these descriptions should be written as JSDoc comments placed on the line above the member.

This convention allows documentation tools like TypeDoc to properly collect and display member documentation.

### Affected Contexts

- Interface properties and methods
- Type literal properties
- Class properties and methods
- Object literal properties

## Examples

### ❌ Incorrect

```ts
interface User {
  id: string // unique identifier
  name: string // display name
  email: string // contact email
}

class Config {
  timeout: number // milliseconds
}

type Options = {
  verbose: boolean // enable verbose output
}
```

### ✅ Correct

```ts
interface User {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Contact email */
  email: string
}

class Config {
  /** Timeout in milliseconds */
  timeout: number
}

type Options = {
  /** Enable verbose output */
  verbose: boolean
}
```

## When Not To Use It

If you prefer trailing comments for brevity and don't use documentation generation tools, you can disable this rule.

## Options

This rule has no options.

## Fixable

This rule is auto-fixable using `--fix`. The fixer:

1. Creates a JSDoc comment with the trailing comment's content
2. Inserts it above the member with proper indentation
3. Removes the trailing comment

If the member already has a JSDoc comment above it, the rule reports an error but does not auto-fix to avoid overwriting existing documentation.
