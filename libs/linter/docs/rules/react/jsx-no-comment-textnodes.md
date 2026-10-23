# react/jsx-no-comment-textnodes

Forbid text in JSX children that looks like a comment.

## Rule Details

Inside JSX children, `// note` and `/* note */` are not comments: they render as text on the page. This rule reports a JSX text node in which any line, leading whitespace aside, starts with `//` or `/*`. A comment in JSX belongs in braces, as `{/* note */}`. It does not fix.

Reimplements [eslint-plugin-react's `jsx-no-comment-textnodes`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-comment-textnodes.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
const banner = (
  <header>
    // shown only on the home page
    <h1>Welcome</h1>
  </header>
)
```

### ✅ Correct

```tsx
const banner = (
  <header>
    {/* shown only on the home page */}
    <h1>Welcome</h1>
  </header>
)
```
