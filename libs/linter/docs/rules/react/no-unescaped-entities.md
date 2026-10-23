# react/no-unescaped-entities

Forbid characters in JSX text that are easily mistaken for markup.

## Rule Details

A stray `>`, `}`, `"` or `'` in JSX text is usually a typo for a closing tag, brace or attribute quote, and a reader cannot tell whether it is meant to render. This rule reports each occurrence of those four characters in JSX text, and the message lists the entities that escape it, such as `&gt;` or `&quot;`. Text inside braces, `{'>'}`, is a JavaScript string and passes. It does not fix.

Reimplements [eslint-plugin-react's `no-unescaped-entities`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md).

## Options

This rule has no options. The original's [`forbid`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md#rule-options) option, which replaces the list of characters, is not read.

## Examples

### ❌ Incorrect

```tsx
const hint = <p>Don't close the tab, it's still "saving"</p>
```

### ✅ Correct

```tsx
const hint = <p>Don&apos;t close the tab, it&apos;s still &ldquo;saving&rdquo;</p>
const quote = <p>{"Don't close the tab"}</p>
```

## Limitations

The parser rejects a bare `>` or `}` in JSX text as a syntax error, as the TypeScript compiler does, so in practice the file fails to parse before this rule can report those two characters; only quotes reach it.
