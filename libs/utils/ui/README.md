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

<!-- hf:media start id="banner" scene="banner-ui-utils" asset="banner" alt="@hyperfrontend/ui-utils" -->
<!-- hf:media end -->

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/ui/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/ui-utils-teardown/hero.gif" alt="Two panels of counters over six mount and unmount cycles: on the left, red bars for style elements, ResizeObservers and listeners climb to six and stay there; on the right, the same three counters in green rise and drop back to zero every cycle">
  </a>
</p>

Modular DOM utilities for dynamic styling, gesture detection, element lifecycle, and color manipulation.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/ui/)
• 👉 See [**API reference**](https://www.hyperfrontend.dev/docs/libraries/utils/ui/#api-reference)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fui-utils)

## What is @hyperfrontend/ui-utils?

Sometimes a framework is not on the table. You are writing an embed that drops into someone else's page, a debug overlay, a script tag, a canvas experiment: something where React would be more runtime than the thing it wraps. So you are back to `document.createElement` and `appendChild`, a `<style>` tag you have to remember to remove, and a `ResizeObserver` you have to remember to disconnect. This package is that pile of chores, written once and tested.

The parts worth the install:

- [`createElement`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-createElement) gives you the node plus attach, detach, show, and hide, with an opacity transition when you pass a duration.
- [`addStylesheet`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/style/#api-addStylesheet) injects real CSS and hands back the function that removes it, so your rules leave when your widget does.
- [`syncElementDimensions`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-syncElementDimensions) pins an overlay to an element you do not control and keeps it there through resizes.
- [`getElementAsync`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-getElementAsync) polls for a node that has not rendered yet and returns a cancel function.
- [`createGestureListener`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/event/#api-createGestureListener) covers Escape and pinch-out with one cleanup.
- [`setupAudio`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/audio/#api-setupAudio) waits for the click or touch that browsers require before an `AudioContext` will start.

Anything that attaches something gives you back the function that detaches it.

At a glance:

```typescript
import { createElement, syncElementDimensions } from '@hyperfrontend/ui-utils/element'
import { addStylesheet } from '@hyperfrontend/ui-utils/style'

const [, removeStyles] = addStylesheet(
  {
    '.hf-hint': { position: 'fixed', opacity: '0', outline: '2px solid #f0f' },
  },
  'hf-hint'
)

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
- **[Elements with a lifecycle](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/)** - attach, detach, show, hide, and a live [`ref`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), all on the object [`createElement`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-createElement) returns
- **[Runtime stylesheets](https://www.hyperfrontend.dev/docs/libraries/utils/ui/style/)** - inject rules from a CSS string or a style map, label them, and get the remover back
- **[CSS selector builder](https://www.hyperfrontend.dev/docs/libraries/utils/ui/selector/)** - chainable [`id`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/selector/#api-CssSelector-prop-id), `class`, [`attribute`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/selector/#api-CssSelector-prop-attribute), [`nth`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/selector/#api-CssSelector-prop-nth), [`childOf`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/selector/#api-CssSelector-prop-childOf), and pseudo-class methods with validation
- **[Color conversion](https://www.hyperfrontend.dev/docs/libraries/utils/ui/color/)** - hex and RGB in both directions, with alpha, plus scaled variations of a base color
- **[Gestures](https://www.hyperfrontend.dev/docs/libraries/utils/ui/event/)** - Escape key and pinch-out behind one listener with one cleanup
- **[Element tracking](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-onElementResize)** - `ResizeObserver` and dimension syncing that stop when you call what they returned
- **[Mobile device detection](https://www.hyperfrontend.dev/docs/libraries/utils/ui/mobile/)** via user agent parsing
- **[Audio unlock](https://www.hyperfrontend.dev/docs/libraries/utils/ui/audio/)** - resolves an `AudioContext` after the click or touch browsers insist on

### Architecture Highlights

Each capability sits behind its own secondary entry point ([`/element`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/), [`/style`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/style/), [`/selector`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/selector/), [`/color`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/color/), [`/event`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/event/), [`/audio`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/audio/), [`/mobile`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/mobile/), [`/time`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/time/), [`/misc`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/misc/), [`/component`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/component/)), so importing one never drags in the rest. Everything is built on plain browser APIs (`ResizeObserver`, touch events, Web Audio) with no third-party dependencies.

## Why Use @hyperfrontend/ui-utils?

### A framework is not always an option

Embeds on someone else's page, browser extensions, tooling panels, canvas demos, snippets that ship as one script tag: places where you cannot mount a component tree, or would rather not pay for one. These are plain functions over plain DOM nodes, so they run under any framework or none, and they do not care what rendered the page around them.

### The cleanup is the point

Overlay code leaks in predictable ways: a stylesheet that outlives the widget it styled, an observer nobody disconnected, a poll still running long after the element showed up. Every function here that attaches something returns the thing that removes it, so teardown is a short list of calls you already have instead of a hunt through the document.

### Following elements you do not control

[`syncElementDimensions`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-syncElementDimensions) takes a source and a target, copies width, height, top, left, and position from one to the other, and repeats that on every resize of the source. Both arguments accept a selector, so the source can be a node that has not rendered yet: [`getElementAsync`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-getElementAsync) polls for it every 100ms and gives up after 10 seconds by default, and the cleanup function cancels the poll if you gave up first.

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

One rule organises the whole surface: anything that attaches something hands back the function that detaches it. [`addStylesheet`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/style/#api-addStylesheet) returns a tuple of the `<style>` element it injected and the function that removes it; [`onElementResize`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-onElementResize) and [`createGestureListener`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/event/#api-createGestureListener) return that remover on its own, one call closing all four listeners in the gesture case. Teardown is a list of functions you are already holding rather than a hunt through the document, which is what the counters above are counting.

The second shape to know is what [`createElement`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-createElement) hands back: not the node, but an object around it carrying [`attachTo`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), [`detachFromParent`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), [`addChild`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), [`removeChild`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), [`show`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), [`hide`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), a [`visible`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods) flag, and [`ref`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods), the live element for anything the wrapper does not do. [`show`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods) and [`hide`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-ElementMethods) take an optional duration in milliseconds and transition opacity over it. The tag shorthands (`div`, [`button`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-button), `canvas` and twenty-one others) are the same function with the tag already chosen.

Targets are elements or selector strings, interchangeably, and that is what lets [`syncElementDimensions`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-syncElementDimensions) pin an overlay to a third-party node before that node exists: underneath, [`getElementAsync`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/element/#api-getElementAsync) polls every 100ms, gives up after 10 seconds, and the cleanup it returns cancels the poll if you gave up first.

Ten secondary entry points sit beside the root one, and they exist for weight rather than filing: importing from [`@hyperfrontend/ui-utils/color`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/color/) costs the color conversions and nothing else, which is what lets any of this into an embed with a few kilobytes to spend. Two are worth naming because their names give nothing away: [`/time`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/time/) is a promise delay and a UTC timestamp formatter, and [`/misc`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/misc/) is one function, [`simpleHash`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/misc/#api-simpleHash), which turns a string into six characters (`simpleHash('hello world')` returns `'to5x38'`).

Every export, option and type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/utils/ui/#api-reference), listed under the entry point it belongs to.

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-ui-utils" asset="runtimes" docs="#compatibility" alt="Runs in evergreen browsers and web workers, with partial support in Node.js 18 or later" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ⚠️     |
| Modern Browsers |    ✅     |
| Web Workers     |    ✅     |

<!-- hf:media end -->

**Note:** Some DOM utilities require browser APIs; check individual exports.

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

**Global variable:** [`HyperfrontendUIUtils`](https://www.hyperfrontend.dev/docs/libraries/utils/ui/)

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/ui)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
