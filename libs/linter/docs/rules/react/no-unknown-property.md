# react/no-unknown-property

Forbid attributes on DOM elements that React does not know.

## Rule Details

React renders DOM attributes by its own names, [`className`](https://react.dev/reference/react-dom/components/common#common-props) rather than `class`, so an HTML spelling or a typo is dropped or triggers a warning at run time. On lower-case DOM elements, this rule reports an attribute React does not recognise. An HTML or SVG name React renames, such as `class`, `for` or `stroke-width`, and a known name written in the wrong case, such as [`onclick`](https://react.dev/learn/responding-to-events), are fixed to React's name. An attribute React allows only on certain tags, such as [`crossOrigin`](https://react.dev/reference/react-dom/components/common#common-props) outside media and link elements, is reported with the tags that take it. Data and ARIA attributes, components, member names, custom elements with a dash, elements with an `is` attribute, and the `<fbt>` and `<fbs>` tags are left alone.

The React version in the settings (`{ react: { version: '16.0' } }`) matters for two groups: [`allowTransparency`](https://legacy.reactjs.org/docs/dom-elements.html) is known only before 16.1, and pointer event handlers such as [`onPointerDown`](https://react.dev/reference/react-dom/components/common#pointerevent-handler) only from 16.4, which is the case when no version is set.

Reimplements [eslint-plugin-react's `no-unknown-property`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unknown-property.md).

## Options

This rule has no options. The [original's options](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unknown-property.md#rule-options), which ignore chosen attributes and require lower-case data attributes, are not read.

## Examples

### ❌ Incorrect

```tsx
const label = <label class="field" for="email" onclick={focus} />
const icon = <svg stroke-width="2" foo="bar" />
```

### ✅ Correct

```tsx
const label = <label className="field" htmlFor="email" onClick={focus} />
const icon = <svg strokeWidth="2" data-icon="check" aria-hidden="true" />
```
