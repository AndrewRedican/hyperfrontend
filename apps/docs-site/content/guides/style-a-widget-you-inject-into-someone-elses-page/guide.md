# How to style a widget you inject into someone else's page

You will give an injected widget its own stylesheet, added when it mounts and gone when it unmounts, with no second copy after a remount and nothing left in the head afterwards.

An embed, a badge, or a debug panel arrives as one script on a page whose markup you do not own. A `<link>` is a request you have to wait for, and a hardcoded `<style>` string is easy to add and hard to find again: mount twice and there are two of them, tear down and it stays. [`@hyperfrontend/ui-utils`](/docs/libraries/utils/ui) hands you the element and its remover together.

## 1. Install it

```bash
npm install @hyperfrontend/ui-utils
```

## 2. Declare your rules as an object

A [`StyleMap`](/docs/libraries/utils/ui/style#api-StyleMap) maps a selector to its declarations, in the camelCase property names you already write in JavaScript. Prefix every selector: your rules and the host page's rules land in one cascade, and the prefix is the only thing keeping `.badge` from meaning two different things.

```js
const RULES = {
  '.acme-badge': {
    position: 'fixed',
    insetBlockEnd: '16px',
    insetInlineEnd: '16px',
    zIndex: '2147483647',
  },
  '.acme-badge[hidden]': { display: 'none' },
}
```

Keys are selectors, so at-rules do not fit. Pass a plain CSS string instead when you need `@media` or `@keyframes`, and keep it in its own sheet.

## 3. Add the sheet under a name

[`addStylesheet`](/docs/libraries/utils/ui/style#api-addStylesheet) builds the rules, appends a `<style>` to the head, and returns the element with a function that removes it. Give it a label and remove that label first, so mounting twice replaces the sheet rather than stacking a second copy:

```js
import { addStylesheet, removeStylesheet } from '@hyperfrontend/ui-utils/style'

function mountBadge() {
  removeStylesheet('acme-badge')
  const [, removeStyles] = addStylesheet(RULES, 'acme-badge')
  // …create and append your element
  return removeStyles
}
```

[`removeStylesheet`](/docs/libraries/utils/ui/style#api-removeStylesheet) does nothing when the label is unknown, which is what makes the first line safe on a first mount. Labels are also how a second script can find your sheet: a label already in use is an error rather than a silent overwrite.

## 4. Take it down with the widget

The remover from the pair is the whole teardown. Call it wherever your widget's own cleanup runs, alongside removing the element:

```js
const removeStyles = mountBadge()

// later, when the host tears the widget down
removeStyles()
```

Calling a stale remover after the sheet is already gone is a no-op, so an unmount path that runs twice needs no guard.

## Check it worked

Mount the widget three times in a row and count `document.head.querySelectorAll('style')`: one sheet, not three, and the badge is positioned the same every time. Unmount, and the count is zero with no rule of yours left in the page. Run the unmount path a second time and nothing throws. Finally, load the widget on a page that already defines its own `.badge` and confirm nothing of yours moved: that is the prefix doing its job.
