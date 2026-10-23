# react/jsx-no-target-blank

Forbid `target="_blank"` on external links without `rel="noreferrer"`.

## Rule Details

A link that opens another site in a new tab hands that page a handle to the opening window in older browsers, which it can use to navigate the original tab elsewhere. `rel="noreferrer"`, which implies `rel="noopener"`, cuts the handle. This rule reports an `<a>` element whose last `target=` attribute may be `"_blank"`, as a literal in any case or as either branch of a conditional, when its `href=` is an external literal (one starting with a scheme such as `https:` or with `//`) or any expression, and its `rel=` does not include noreferrer in every value it may take.

The fix adds `rel="noreferrer"` after the last attribute, gives a bare rel attribute that value, or appends noreferrer to a literal value. It is withheld when a spread attribute after the target, or a spread with no rel attribute at all, could supply the value, and when the rel value is an expression.

Reimplements [eslint-plugin-react's `jsx-no-target-blank`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-target-blank.md).

## Options

This rule has no options. The [original's options](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-target-blank.md#rule-options), which allow the referrer, skip dynamic links, warn on spreads and check forms, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```tsx
const docs = (
  <a href="https://example.com/docs" target="_blank">
    Docs
  </a>
)
```

```tsx
const profile = (url: string) => (
  <a href={url} target="_blank" rel="noopener">
    Profile
  </a>
)
```

### ✅ Correct

```tsx
const docs = (
  <a href="https://example.com/docs" target="_blank" rel="noreferrer">
    Docs
  </a>
)

const help = (
  <a href="/help" target="_blank">
    Help
  </a>
)
```

## Limitations

Only the `<a>` element is checked: the original's link components setting, which adds custom link components and their address props, is not read.
