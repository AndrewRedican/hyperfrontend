# @hyperfrontend/ui-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-ui-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-ui-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=ui-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=ui-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/ui-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/ui-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/ui-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fui-utils?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/ui-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/ui-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Modular DOM utilities for dynamic styling, gesture detection, element lifecycle, and color manipulation.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/ui/)
• 👉 See [**API reference**](https://www.hyperfrontend.dev/docs/libraries/utils/ui/#api-reference)

## What is @hyperfrontend/ui-utils?

Sometimes a framework is not on the table. You are writing an embed that drops into someone else's page, a debug overlay, a script tag, a canvas experiment: something where React would be more runtime than the thing it wraps. So you are back to `document.createElement` and `appendChild`, a `<style>` tag you have to remember to remove, and a `ResizeObserver` you have to remember to disconnect. This package is that pile of chores, written once and tested.

The parts worth the install: `createElement` gives you the node plus attach, detach, show, and hide, with an opacity transition when you pass a duration. `addStylesheet` injects real CSS and hands back the function that removes it, so your rules leave when your widget does. `syncElementDimensions` pins an overlay to an element you do not control and keeps it there through resizes. `getElementAsync` polls for a node that has not rendered yet and returns a cancel function. `createGestureListener` covers Escape and pinch-out with one cleanup. `setupAudio` waits for the click or touch that browsers require before an `AudioContext` will start. Anything that attaches something gives you back the function that detaches it.

At a glance:

```typescript
import { createElement, syncElementDimensions } from '@hyperfrontend/ui-utils/element'
import { addStylesheet } from '@hyperfrontend/ui-utils/style'

const [, removeStyles] = addStylesheet({ '.hf-hint': { position: 'fixed', opacity: '0', outline: '2px solid #f0f' } }, 'hf-hint')

const hint = createElement('div', { className: 'hf-hint' })
hint.attachTo(document.body)
hint.show(150) // opacity transition over 150ms

// follow a node you do not own, through every resize
const stopTracking = syncElementDimensions('#third-party-widget', hint.ref)

// teardown leaves the page as you found it
stopTracking()
hint.detachFromParent()
removeStyles()
```

### Key Features

- **Modular secondary entry points** for importing one corner of the package at a time
- **Elements with a lifecycle** - attach, detach, show, hide, and a live `ref`, all on the object `createElement` returns
- **Runtime stylesheets** - inject rules from a CSS string or a style map, label them, and get the remover back
- **CSS selector builder** - chainable `id`, `class`, `attribute`, `nth`, `childOf`, and pseudo-class methods with validation
- **Color conversion** - hex and RGB in both directions, with alpha, plus scaled variations of a base color
- **Gestures** - Escape key and pinch-out behind one listener with one cleanup
- **Element tracking** - `ResizeObserver` and dimension syncing that stop when you call what they returned
- **Mobile device detection** via user agent parsing
- **Audio unlock** - resolves an `AudioContext` after the click or touch browsers insist on

### Architecture Highlights

Each capability sits behind its own secondary entry point (`/element`, `/style`, `/selector`, `/color`, `/event`, `/audio`, `/mobile`, `/time`, `/misc`, `/component`), so importing one never drags in the rest. The pattern throughout is that anything touching the document returns its own undo: `addStylesheet` returns the style element and a remover, `onElementResize` and `syncElementDimensions` return disconnect functions, `getElementAsync` returns a cancel function. Everything is built on plain browser APIs (`ResizeObserver`, touch events, Web Audio) with no third-party dependencies.

## Why Use @hyperfrontend/ui-utils?

### A framework is not always an option

Embeds on someone else's page, browser extensions, tooling panels, canvas demos, snippets that ship as one script tag: places where you cannot mount a component tree, or would rather not pay for one. These are plain functions over plain DOM nodes, so they run under any framework or none, and they do not care what rendered the page around them.

### The cleanup is the point

Overlay code leaks in predictable ways: a stylesheet that outlives the widget it styled, an observer nobody disconnected, a poll still running long after the element showed up. Every function here that attaches something returns the thing that removes it, so teardown is a short list of calls you already have instead of a hunt through the document.

### Following elements you do not control

`syncElementDimensions` takes a source and a target, copies width, height, top, left, and position from one to the other, and repeats that on every resize of the source. Both arguments accept a selector, so the source can be a node that has not rendered yet: `getElementAsync` polls for it every 100ms and gives up after 10 seconds by default, and the cleanup function cancels the poll if you gave up first.

### Import one corner, not the package

Every capability is its own entry point, so `import { hexToRgb } from '@hyperfrontend/ui-utils/color'` pulls in the color conversions and nothing else. That matters when the whole budget for an embed is a few kilobytes.

## Installation

```bash
npm install @hyperfrontend/ui-utils
```

## Quick Start

```typescript
// Element creation with lifecycle methods
import { createElement } from '@hyperfrontend/ui-utils/element'

const modal = createElement('div', {
  className: 'modal',
  inlineStyle: { position: 'fixed', zIndex: '1000' },
})

modal.attachTo(document.body)
modal.show(300) // Fade in over 300ms
modal.hide(300) // Fade out over 300ms
modal.detachFromParent() // Clean removal

// Type-safe CSS selector building
import { CssSelector } from '@hyperfrontend/ui-utils/selector'

const selector = new CssSelector('div').class('card').attribute('data-status', 'active').hover().toString() // 'div.card[data-status="active"]:hover'

// Color manipulation
import { getColorVariation, hexToRgb, rgbToHex } from '@hyperfrontend/ui-utils/color'

const dimmedBlue = getColorVariation('#0066cc', 128) // 'rgba(0,51,102,0.5019607843137255)'
const rgb = hexToRgb('#ff5500') // { r: 255, g: 85, b: 0 }
const hex = rgbToHex(255, 85, 0) // '#ff5500'

// Gesture detection with cleanup
import { createGestureListener } from '@hyperfrontend/ui-utils/event'

const cleanup = createGestureListener(() => console.log('Escape or pinch detected'))
// Later: cleanup() to remove listeners
```

## API Overview

### Element Utilities (`/element`)

- **`createElement(tagName, config)`** - Create an element and get attach, detach, show, hide, and `ref` back
- **`div(config)`, `span(config)`, `button(config)`, and the rest** - Shorthands for the common tags
- **`getElementAsync(selector, options)`** - Poll for an element, with `onSuccess`, `onFail`, `duration`, and `interval`; returns a cancel function
- **`syncElementDimensions(source, target, options)`** - Copy size and position from source to target on every resize
- **`onElementResize(element, callback)`** - `ResizeObserver` wrapper that returns its own disconnect

### Style Utilities (`/style`)

- **`addStylesheet(css, label)`** - Add a `<style>` element from a CSS string or style map; returns the element and a remover
- **`removeStylesheet(styleElementOrLabel)`** - Remove a stylesheet added earlier
- **`createApplyStyle(selector, style)` / `createApplyStyles(styles)`** - Build a run-once function that injects the rules on first call
- **`cssRule(selector, css)` / `cssRules(styleMap)`** - Turn style objects into CSS rule text
- **`cssObjectToString(css)`** - Convert a style object to a CSS declaration string

### Selector Utilities (`/selector`)

- **`CssSelector`** - Chainable selector builder: `id`, `class`, `attribute`, `first`, `last`, `nth`, `hover`, `active`, `focus`, `pseudo`, `childOf`, `parentOf`, sibling combinators
- **`select`, `selectBy`, `selectByElement`, `selectById`, `selectByClass`, `selectByAttribute`, `selectAllElements`** - Start a builder from a tag, id, class, or attribute
- **`isValidCssSelector(selector)`** - Validate CSS selector strings

### Color Utilities (`/color`)

- **`getColorVariation(baseColor, intensity)`** - Scale a hex color by an intensity of 0 to 255, returned as an `rgba()` string with matching alpha
- **`hexToRgb(hex)`** / **`rgbToHex(r, g, b, a?)`** - Convert between hex and channel values, with optional alpha
- **`rgbToString(rgb)`** - Turn an RGB object into an `rgb()` or `rgba()` string
- **`rgbStringToHex(rgbString)`** - Parse a CSS color string back to hex

### Event Utilities (`/event`)

- **`createGestureListener(callback)`** - Fire on Escape or a pinch-out; returns one cleanup for all four listeners
- **`clickAtPosition(x, y)`** - Dispatch a synthetic `mousedown` at document coordinates

### Mobile Utilities (`/mobile`)

- **`isMobileDevice()`** - User agent based mobile detection

### Component Utilities (`/component`)

- **`component(create, style)`** - Pair a factory with a stylesheet function, injected once on first call

### Audio Utilities (`/audio`)

- **`setupAudio(elementOrSelector)`** - Resolve an `AudioContext` once the user clicks or touches the given element

### Time Utilities (`/time`)

- **`pause(ms)`** - Promise that resolves after a delay
- **`timestampToDateTime(timestamp)`** - Format a millisecond timestamp as a UTC date and time string

### Misc Utilities (`/misc`)

- **`simpleHash(str)`** - Six character non-cryptographic string hash, handy for generated class names

## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ⚠️¹   |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

**Note:** ¹ Some DOM utilities require browser APIs; check individual exports.

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/ui-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/ui-utils"></script>

<script>
  const { createElement, hexToRgb, rgbToHex } = HyperfrontendUIUtils
</script>
```

**Global variable:** `HyperfrontendUIUtils`

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/ui)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
