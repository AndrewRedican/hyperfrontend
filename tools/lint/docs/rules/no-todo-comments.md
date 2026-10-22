# no-todo-comments

Disallow TODO comments and their common permutations in all comment types.

## Rule Details

This rule prohibits `TODO`, `to-do`, `to do` (case-insensitive) markers in line comments (`//`), block comments (`/* */`), and JSDoc comments (`/** */`). It uses word-boundary detection (not regex) to avoid false positives from naturally occurring substrings like "path-to-document" or "auto download".

### Why?

- **Tracking**: Issues should be tracked in a proper issue tracker, not buried in source code
- **Code cleanliness**: TODO comments tend to accumulate and become stale
- **Visibility**: Comments in code are invisible to project management tools
- **Accountability**: Issue trackers assign ownership; TODO comments do not

## Examples

### ❌ Incorrect

```typescript
// TODO: fix validation
```

```typescript
/* TO-DO: refactor this */
```

```typescript
/** @todo add error handling */
```

```typescript
// to do: handle edge case
```

### ✅ Correct

```typescript
// This validates the input format
```

```typescript
// See path-to-document for details
```

```typescript
// Prevent auto download of files
```

```typescript
// The todo-app package handles this
```

## When Not To Use It

If your project uses TODO comments as an accepted workflow pattern or does not use an external issue tracker.
