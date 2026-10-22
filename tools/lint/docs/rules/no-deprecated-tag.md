# no-deprecated-tag

Disallow the deprecated JSDoc tag. Breaking changes are handled through semantic versioning.

## Rule Details

This rule prohibits the use of `@deprecated` JSDoc tags. This project handles breaking changes through semantic versioning and does not maintain backwards compatibility across major versions.

### Why?

- **Semantic versioning**: Breaking changes are communicated through major version bumps
- **Code cleanliness**: No accumulated deprecated code sitting around
- **Clear intention**: Either remove code in the next major version or keep it
- **Reduced complexity**: No need to maintain deprecated alternatives

## Examples

### ❌ Incorrect

```typescript
/**
 * @deprecated Use newFunction instead
 */
function oldFunction() {
  // ...
}
```

### ✅ Correct

```typescript
/**
 * Performs the operation.
 * Note: This replaces the previous implementation.
 */
function newFunction() {
  // ...
}
```

## When Not To Use It

If your project:

- Needs to maintain backwards compatibility
- Has long deprecation cycles
- Publishes to npm and wants to warn users before removing APIs

## Philosophy

This rule enforces the project's stance that deprecated code should be removed in the next major version rather than accumulated with deprecation warnings.
