# max-file-lines

Enforce a maximum file line count for files with multiple functions.

## Rule Details

This rule encourages smaller, focused files by enforcing a maximum line count. It only applies to files that contain more than one function, allowing single-purpose utility files to be as long as needed while encouraging separation of concerns in multi-function files.

### Why?

- **Separation of concerns**: Large files often indicate multiple responsibilities that should be split into separate modules
- **Maintainability**: Smaller files are easier to read, understand, and modify
- **Testability**: Focused modules with single responsibilities are easier to test
- **Code review**: Smaller files make pull requests more reviewable

### Behavior

- Files with **one or zero functions** are exempt from this rule
- **Test files** (`.spec.ts`, `.test.ts`, etc.) have a separate, typically higher limit
- The rule counts: function declarations, function expressions, arrow functions, and class methods

## Options

This rule accepts an options object with the following properties:

| Option         | Type      | Default | Description                            |
| -------------- | --------- | ------- | -------------------------------------- |
| `maxLines`     | `integer` | `300`   | Maximum lines for implementation files |
| `maxLinesTest` | `integer` | `500`   | Maximum lines for test files           |

### Test File Detection

Files are identified as test files if they end with:

- `.spec.ts`, `.spec.tsx`, `.spec.js`, `.spec.jsx`
- `.test.ts`, `.test.tsx`, `.test.js`, `.test.jsx`

## Examples

### ❌ Incorrect

A file with 350 lines and multiple functions:

```typescript
// utils.ts (350 lines)
export function parseData(input: string) {
  // ...implementation
}

export function validateData(data: unknown) {
  // ...implementation
}

export function transformData(data: Data) {
  // ...implementation
}

// ...more code totaling 350 lines
```

### ✅ Correct

Split into focused, single-purpose modules:

```typescript
// parse.ts (100 lines)
export function parseData(input: string) {
  // ...implementation
}
```

```typescript
// validate.ts (80 lines)
export function validateData(data: unknown) {
  // ...implementation
}
```

```typescript
// transform.ts (120 lines)
export function transformData(data: Data) {
  // ...implementation
}
```

### Configuration

```javascript
// eslint.config.js
export default [
  {
    rules: {
      '@nx/workspace/max-file-lines': [
        'error',
        {
          maxLines: 250, // Stricter limit for implementation
          maxLinesTest: 600, // More lenient for tests
        },
      ],
    },
  },
]
```

## When Not To Use It

- If your team prefers larger, more comprehensive modules
- For generated files or configuration files
- For files that are intentionally comprehensive (e.g., type definitions)

Consider using file-specific overrides for exceptions rather than disabling the rule entirely.

## Related Rules

- ESLint's built-in `max-lines` rule (applies to all files regardless of function count)
- `max-lines-per-function` (limits individual function size)
