# @hyperfrontend/questions

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-questions.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-questions.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=questions">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=questions" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/questions">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/questions?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/questions">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fquestions?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/questions">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/questions?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/questions/">
    <img width="640" src="https://www.hyperfrontend.dev/media/questions-prompt/hero.gif" alt="A multiselect prompt being programmed on the left and answered on the right, ending in a submitted result object">
  </a>
</p>
<p align="center">
  <sub>The call you write, and the session it produces. An answered prompt resolves; a cancelled one resolves too.</sub>
</p>

Terminal prompting library with composable, functional API for text, select, confirm, and multiselect prompts

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/questions/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fquestions)

## What is @hyperfrontend/questions?

A terminal prompting library built on functional programming principles. Create interactive CLI experiences with composable, type-safe prompts that return structured outcomes.

### Key Features

- **Pure Functions**: Every prompt is a pure function returning `Promise<PromptOutcome<T>>`, making results predictable and easily testable
- **Composable API**: Build complex interactive flows by combining simple prompt functions
- **Type-Safe**: Full TypeScript support with discriminated unions for prompt outcomes
- **Zero External Dependencies**: Uses only Node.js built-ins and `@hyperfrontend` utilities
- **Searchable Multiselect**: Type-to-filter functionality for large option lists
- **Clipboard Paste**: Bracketed paste mode on TTYs (with a multi-character-chunk fallback elsewhere); pasted text is sanitized and never auto-submits
- **Resize-Aware Rendering**: Prompts hard-wrap to the terminal width and repaint on resize, preserving value, cursor, selection, and validation state

### Architecture Highlights

- **Explicit outcomes**: prompts resolve to either `{ result: 'submitted', value: T }` or `{ result: 'cancelled', value: undefined }`, so Ctrl+C is an ordinary branch to handle rather than a rejection to catch
- **Terminal state is restored**: raw mode is taken once for the whole prompt session and given back when it closes, on cancel as well as on submit
- **Rendering assumptions**: repainting on resize assumes a reflowing terminal, and display width is counted in code points, so east-asian double-width characters are out of scope

## Why Use @hyperfrontend/questions?

When building CLI tools, you need interactive prompts that are:

1. **Predictable**: Know exactly what a prompt returns, always
2. **Composable**: Chain prompts without callback hell
3. **Cancellable**: Handle Ctrl+C gracefully with structured cancellation
4. **Lightweight**: No large dependency trees for simple prompts

This library provides all four while staying true to functional programming principles.

## Installation

```bash
npm install @hyperfrontend/questions
```

## Quick Start

```typescript
import { text, confirm, select, multiselect, PromptResult } from '@hyperfrontend/questions'

// Text input
const nameResult = await text({
  message: 'What is your name?',
  validate: (value) => (value.length < 2 ? 'Name too short' : undefined),
})

if (nameResult.result === PromptResult.Submitted) {
  console.log(`Hello, ${nameResult.value}!`)
}

// Text input with a live label; `renderMessage` is recomputed on every keystroke
import { style } from '@hyperfrontend/questions'

await text({
  message: 'Title:',
  renderMessage: (value) => {
    const left = 72 - value.length
    return `Title (${left >= 0 ? style.green(`${left} left`) : style.red(`${-left} over`)}):`
  },
})

// Confirmation
const continueResult = await confirm({
  message: 'Continue?',
  initial: true,
})

// Single select
const colorResult = await select({
  message: 'Pick a color:',
  choices: [
    { label: 'Red', value: 'red' },
    { label: 'Green', value: 'green', hint: 'recommended' },
    { label: 'Blue', value: 'blue' },
  ],
})

// Multiselect with search
const featuresResult = await multiselect({
  message: 'Select features:',
  choices: [
    { label: 'TypeScript', value: 'ts' },
    { label: 'ESLint', value: 'eslint' },
    { label: 'Prettier', value: 'prettier' },
  ],
  searchable: true,
  min: 1,
})
```

## API Overview

Four prompts, one shape. [`text`](https://www.hyperfrontend.dev/docs/libraries/questions/#api-text), [`confirm`](https://www.hyperfrontend.dev/docs/libraries/questions/#api-confirm), [`select`](https://www.hyperfrontend.dev/docs/libraries/questions/#api-select) and [`multiselect`](https://www.hyperfrontend.dev/docs/libraries/questions/#api-multiselect) each take a config object and resolve to the same discriminated union, so the code that reads an answer is the same code whichever question asked it:

```typescript
type PromptOutcome<T> = { result: 'submitted'; value: T } | { result: 'cancelled'; value: undefined }
```

Two things sit beside them. [`style`](https://www.hyperfrontend.dev/docs/libraries/questions/#api-style) is the ANSI colour helper the prompts use on their own labels, exposed so yours can match. And every config takes `input` and `output` streams, which is what makes a prompt testable without a TTY: hand it a pair of `PassThrough`s, write keystrokes into one and read frames out of the other.

Every config, option and outcome type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/questions/#api-reference).

## Compatibility

| Environment                    | Supported |
| ------------------------------ | --------- |
| Node.js >= 18                  | ✅        |
| TTY Terminal                   | ✅        |
| Bracketed paste (TTY)          | ✅        |
| Resize redraw (SIGWINCH)       | ✅        |
| Non-TTY streams (tests, pipes) | ✅        |
| Tree Shakeable                 | ✅        |

On TTY inputs a prompt session enables bracketed paste mode (`ESC[?2004h`) and restores it on close; terminals without bracketed paste still paste correctly because multi-character input chunks are treated as pastes. Single-line prompts collapse pasted newlines into spaces, so pasting can never submit a value.

### Output Formats

| Format | File           | Tree-Shakeable |
| ------ | -------------- | :------------: |
| ESM    | `index.esm.js` |       ✅       |
| CJS    | `index.cjs.js` |       ❌       |

No browser bundle is published: the library drives a terminal, so an IIFE or UMD build would have nothing to run against.

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
