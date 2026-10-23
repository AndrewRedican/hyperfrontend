# react/jsx-uses-react

Mark the JSX pragma, and the fragment component, as used wherever JSX appears.

## Rule Details

With the classic JSX transform, every element compiles to a call on the pragma, [`React.createElement`](https://react.dev/reference/react/createElement) by default, so an `import React from 'react'` that the code never names is still needed. This rule reports nothing itself: it marks the pragma variable as used at every JSX element, and the pragma and the fragment component at every `<>` fragment, so that [`typescript/no-unused-vars`](../typescript/no-unused-vars.md) does not report them. It only has an effect when that rule runs too.

The pragma comes from a `@jsx` comment in the file, then the settings (`{ react: { pragma: 'h' } }`), then [`React`](https://react.dev/reference/react). The fragment's name comes from the settings (`{ react: { fragment: 'Frag' } }`), then [`Fragment`](https://react.dev/reference/react/Fragment). With the automatic JSX runtime, React 17 and later, the import is not needed and this rule can stay off.

Reimplements [eslint-plugin-react's `jsx-uses-react`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-uses-react.md).

## Options

This rule has no options.

## Examples

### ✅ Correct

```tsx
import React from 'react'

export const greeting = <p>Hello</p>
```
