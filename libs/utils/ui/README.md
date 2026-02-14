# @hyperfrontend/ui-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-ui-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-ui-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=ui-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=ui-utils" alt="Coverage">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/ui-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/ui-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/ui-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/ui-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
</p>

Modular DOM utilities for dynamic styling, gesture detection, element lifecycle, and color manipulation.

## What is @hyperfrontend/ui-utils?

@hyperfrontend/ui-utils provides framework-agnostic browser utilities organized into modular secondary entry points. Rather than importing the entire library, you import only the specific capabilities you need: `@hyperfrontend/ui-utils/element` for DOM creation, `@hyperfrontend/ui-utils/color` for color transformations, `@hyperfrontend/ui-utils/mobile` for device detection, etc.

The library emphasizes dynamic styling through programmatic CSS injection, type-safe CSS selector building, and gesture detection for touch and keyboard events. All utilities support TypeScript and provide immutable patterns through frozen objects and functional composition.

### Key Features

- **Modular secondary entry points** for selective imports and tree-shaking
- **Dynamic element creation** with fluent API for show/hide, attach/detach operations
- **CSS-in-JS utilities** including selector builder, style injection, and CSS object transformation
- **Color manipulation** (hex/RGB conversion, variation generation)
- **Gesture detection** (pinch-to-zoom, escape key handling)
- **Mobile device detection** via user agent parsing
- **Element observers** (ResizeObserver wrapper with cleanup)
- **Audio setup** utilities for web audio APIs

### Architecture Highlights

Built on secondary entry points (`/element`, `/color`, `/style`, `/event`, etc.) for optimal bundle sizes. All DOM manipulation returns frozen objects with cleanup functions to prevent memory leaks. Uses native browser APIs (ResizeObserver, TouchEvent, Web Audio) with zero external dependencies except sibling utilities.

## Why Use @hyperfrontend/ui-utils?

### Eliminates Boilerplate for Dynamic DOM Operations

Creating, styling, and managing element lifecycles in vanilla JavaScript requires repetitive `createElement`, `appendChild`, and cleanup logic. The `createElement()` utility provides a fluent API with automatic parent attachment, fade in/out transitions, and cleanup methods—reducing 15+ lines of DOM code to 3-4 lines.

### Type-Safe CSS Selector Building

Hand-writing CSS selectors as strings is error-prone and offers no IDE autocomplete. The `CssSelector` builder provides chainable methods (`.id()`, `.class()`, `.tag()`, `.attribute()`) with validation, preventing malformed selectors and enabling refactoring support. Particularly valuable when generating complex selectors programmatically.

### Prevents ResizeObserver Memory Leaks

Raw ResizeObserver usage requires careful cleanup to avoid memory leaks in SPAs. `onElementResize()` returns a cleanup function and automatically handles disconnection, making it safe for component unmounting in React/Vue/Angular without manual observer management.

### Modular Imports Reduce Bundle Size

Most DOM utility libraries force all-or-nothing imports. Secondary entry points let you import only what you need (`import { createElement } from '@hyperfrontend/ui-utils/element'`), keeping production bundles lean when you only need color conversion or mobile detection.

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

const selector = new CssSelector('div').class('card').attribute('data-status', 'active').pseudoClass('hover').toString() // "div.card[data-status='active']:hover"

// Color manipulation
import { getColorVariation, hexToRgb, rgbToHex } from '@hyperfrontend/ui-utils/color'

const lighterBlue = getColorVariation('#0066cc', 128) // Lightened version
const rgb = hexToRgb('#ff5500') // { r: 255, g: 85, b: 0 }
const hex = rgbToHex(255, 85, 0) // "#ff5500"

// Gesture detection with cleanup
import { createGestureListener } from '@hyperfrontend/ui-utils/event'

const cleanup = createGestureListener(() => console.log('Escape or pinch detected'))
// Later: cleanup() to remove listeners
```

## API Overview

### Element Utilities (`/element`)

- **`createElement(tagName, config)`** - Create elements with fluent API for lifecycle management
- **`getElementAsync(selector, timeout)`** - Wait for element to appear in DOM (Promise-based)
- **`syncElementDimensions(source, target)`** - Keep target dimensions synchronized with source
- **`onElementResize(element, callback)`** - ResizeObserver wrapper with cleanup

### Style Utilities (`/style`)

- **`createApplyStyle(selector, style)`** - Inject CSS rules dynamically
- **`cssObjectToString(css)`** - Convert style objects to CSS strings
- **`CssRule` / `CssRules`** - Programmatic CSS rule generation
- **`addStylesheet(rules, id)`** - Add stylesheet to document

### Selector Utilities (`/selector`)

- **`CssSelector`** - Chainable CSS selector builder with validation
- **`isValidCssSelector(selector)`** - Validate CSS selector strings

### Color Utilities (`/color`)

- **`getColorVariation(baseColor, intensity)`** - Generate lighter/darker color variations
- **`hexToRgb(hex)`** / **`rgbToHex(r, g, b)`** - Color format conversion
- **`rgbToString(rgb)`** - Convert RGB object to CSS string
- **`rgbStringToHex(rgbString)`** - Parse CSS color strings to hex

### Event Utilities (`/event`)

- **`createGestureListener(callback)`** - Detect pinch gestures and escape key
- **`clickAtPosition(x, y)`** - Programmatic click at coordinates

### Mobile Utilities (`/mobile`)

- **`isMobileDevice()`** - User agent-based mobile detection

### Component Utilities (`/component`)

- **`component(create, style)`** - Wrap element creation with style injection

### Audio Utilities (`/audio`)

- **`setupAudio()`** - Web Audio API setup utilities

### Time Utilities (`/time`)

- **`timestampToDateTime(timestamp)`** - Convert timestamps to formatted date/time

### Misc Utilities (`/misc`)

- **`pause(ms)`** - Promise-based delay
- **`simpleHash(str)`** - Generate simple string hashes

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

**Bundle size:** < 1 KB (minified, self-contained)

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/ui-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/ui-utils"></script>

<script>
  const { hexToRgb, rgbToHex, isElementVisible } = HyperfrontendUIUtils
</script>
```

**Global variable:** `HyperfrontendUIUtils`

### Dependencies

| Package                               | Type     |
| ------------------------------------- | -------- |
| @hyperfrontend/data-utils             | Internal |
| @hyperfrontend/function-utils         | Internal |
| @hyperfrontend/list-utils             | Internal |
| @hyperfrontend/random-generator-utils | Internal |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

## License

MIT
