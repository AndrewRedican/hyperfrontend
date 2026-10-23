# prefer-jsdoc-over-trailing-comments

Require interface members to be documented by a JSDoc block above them, not by a trailing line comment.

## Rule Details

Documentation tools such as TypeDoc and editors' hover cards collect a member's JSDoc block and ignore a `//` comment trailing it on the same line, so the description is lost wherever the member is read. The rule reports a line comment that follows an interface member on the member's own line. The fix moves the comment's text into a `/** … */` block above the member, at the member's indentation. When the member already has a JSDoc block above it, the rule reports without a fix, so existing documentation is never overwritten.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
interface User {
  id: string // unique identifier
  name: string // display name
}
```

### ✅ Correct

```ts
interface User {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
}
```

## Limitations

Only interface bodies are read. Members of a type literal, a class or an object literal with a trailing comment are not reported.
