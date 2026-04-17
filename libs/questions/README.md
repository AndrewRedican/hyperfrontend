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

Terminal prompting library with composable, functional API for text, select, confirm, and multiselect prompts

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/questions/)

## What is @hyperfrontend/questions?

A terminal prompting library built on functional programming principles. Create interactive CLI experiences with composable, type-safe prompts that return structured outcomes.

### Key Features

- **Pure Functions** — Every prompt is a pure function returning `Promise<PromptOutcome<T>>`, making results predictable and easily testable
- **Composable API** — Build complex interactive flows by combining simple prompt functions
- **Type-Safe** — Full TypeScript support with discriminated unions for prompt outcomes
- **Zero External Dependencies** — Uses only Node.js built-ins and `@hyperfrontend` utilities
- **Searchable Multiselect** — Type-to-filter functionality for large option lists

### Architecture Highlights

Each prompt follows a functional state machine pattern:

- **Immutable State** — All prompt state is frozen; updates create new state objects
- **Explicit Outcomes** — Prompts return either `{ result: 'submitted', value: T }` or `{ result: 'cancelled', value: undefined }`
- **Terminal Abstraction** — Low-level I/O is encapsulated in a `Terminal` interface for testability

## Why Use @hyperfrontend/questions?

When building CLI tools, you need interactive prompts that are:

1. **Predictable** — Know exactly what a prompt returns, always
2. **Composable** — Chain prompts without callback hell
3. **Cancellable** — Handle Ctrl+C gracefully with structured cancellation
4. **Lightweight** — No large dependency trees for simple prompts

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

| Function       | Description                                       |
| -------------- | ------------------------------------------------- |
| `text`         | Free-form text input with optional validation     |
| `confirm`      | Yes/no confirmation prompt                        |
| `select`       | Single selection from a list of choices           |
| `multiselect`  | Multiple selections with optional search          |
| `PromptResult` | Discriminated union: `'submitted' \| 'cancelled'` |

All prompts return `Promise<PromptOutcome<T>>` where:

```typescript
type PromptOutcome<T> = { result: 'submitted'; value: T } | { result: 'cancelled'; value: undefined }
```

## Compatibility

| Environment    | Supported |
| -------------- | --------- |
| Node.js >= 18  | ✅        |
| TTY Terminal   | ✅        |
| Tree Shakeable | ✅        |

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
