# react/no-danger-with-children

Forbid setting both children and [`dangerouslySetInnerHTML`](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html) on one element.

## Rule Details

[`dangerouslySetInnerHTML`](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html) replaces an element's content, so children given alongside it are either lost or make React throw. This rule reports a JSX element that has the HTML prop and also has children, or a [`children`](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children) prop; whitespace that only spans a line break does not count as a child. It also reports a `.createElement()` call whose props carry the HTML prop while children are passed as further arguments or as a prop. Props are followed through spread attributes and identifiers to the object literal a variable is initialised with. It does not fix.

Reimplements [eslint-plugin-react's `no-danger-with-children`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-danger-with-children.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
const html = { __html: '<b>Saved</b>' }

const note = <div dangerouslySetInnerHTML={html}>Saved</div>
```

### ✅ Correct

```tsx
const html = { __html: '<b>Saved</b>' }

const note = <div dangerouslySetInnerHTML={html} />
const plain = <div>Saved</div>
```

## Limitations

Any `.createElement()` call is checked, whatever object it is read from; a bare `createElement` call is not.
