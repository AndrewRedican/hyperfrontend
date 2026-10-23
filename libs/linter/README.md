# @hyperfrontend/linter

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-linter.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-linter.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=linter">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=linter" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/linter">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/linter?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/linter">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Flinter?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/linter">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/linter?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/linter/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/linter-mend/hero.gif" alt="A TypeScript file, cart.ts, sits on a sheet while a beam reads it line by line; as each line is read its node appears beside the sheet at the same height, nested the way the code nests. Three rules find something: var is underlined and no-var lands beside its node, let count is underlined with prefer-const, and !!item.price with no-extra-boolean-cast. The --fix flag lights on the hf-lint chip and the fixes land one by one: let total, const count and item.price are written in place, each underline retracts, each tag gets a check, and a check lands beside the file's name">
  </a>
</p>

A linter for TypeScript, JavaScript, JSX, JSON and Markdown with its own parsers and no external runtime packages.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/linter/)

• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Flinter)

## What is @hyperfrontend/linter?

[`@hyperfrontend/linter`](https://www.hyperfrontend.dev/docs/libraries/linter/) checks TypeScript, JavaScript, JSX, JSON and Markdown against rules you choose, and fixes what the rules know how to fix. It parses every file with parsers of its own and installs no dependencies.

It is not a drop-in [ESLint](https://eslint.org/). It reimplements a selection of rules from ESLint and well-known plugins, under a configuration that reads like ESLint's flat config, and it does not load ESLint plugins, parsers or shareable configs.

### Key Features

- **[Packaged rules](https://www.hyperfrontend.dev/docs/libraries/linter/rules/)** - Core JavaScript, TypeScript, JSDoc, React, React hooks and package.json rules, and a set of conventions
- **[Presets to start from](https://www.hyperfrontend.dev/docs/libraries/linter/#api-CODE_RULES)** - The rules the upstream recommended configurations turn on, as plain objects you spread into a block
- **One parse, one traversal** - The listeners of every rule in effect for a file run in a single walk of its tree
- **[Rules of your own](https://www.hyperfrontend.dev/docs/libraries/linter/#api-defineRule)** - Register them under a prefix with [`families`](https://www.hyperfrontend.dev/docs/libraries/linter/#api-ConfigBlock-prop-families) and test them with [`testRule`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/)
- **Fixes and suggestions** - `--fix` applies fixes; suggestions, for changes that need your judgement, appear in the JSON report
- **No dependencies** - The package is self-contained; linting loads nothing from npm

### Architecture Highlights

Every file is parsed once and every rule's listeners run in one traversal of it; the services rules share, such as scopes and code paths, are computed once per file and never rebuilt. The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/linter/architecture/) covers the parsers, the shared services and the fix loop.

## Why Use @hyperfrontend/linter?

### Fewer packages in the toolchain

A linting setup built on ESLint brings a parser, plugins and their dependencies into every install. This package is one dependency with nothing beneath it, for a project whose checks fit its rules.

### Rules you can read and own

Each rule is one module with its specification beside it. When the packaged rules stop short, [write and test a rule of your own](https://www.hyperfrontend.dev/docs/guides/write-and-test-a-custom-lint-rule/) with the same API they use.

## Installation

```bash
npm install --save-dev @hyperfrontend/linter
```

Requires Node.js 24 or later, which loads the TypeScript configuration file without a compiler.

## Quick Start

Create `lint.config.ts` at the project root:

```typescript
import { CODE, CODE_RULES, on } from '@hyperfrontend/linter'

export default [
  { ignores: ['dist/', 'coverage/'] },
  { files: CODE, rules: CODE_RULES },
  { files: ['src/**/*.ts'], rules: on('no-enum import-order') },
]
```

Then lint and fix from the project root:

```bash
npx hf-lint
npx hf-lint src --fix
```

[Lint a project with @hyperfrontend/linter](https://www.hyperfrontend.dev/docs/guides/lint-a-project-with-hyperfrontend-linter/) covers configuration, directives, exit codes, CI and linting from code with [`lint`](https://www.hyperfrontend.dev/docs/libraries/linter/#api-lint).

## API Overview

| Entry                                                                           | What it is                                                                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@hyperfrontend/linter`](https://www.hyperfrontend.dev/docs/libraries/linter/) | Running, configuration types and presets, [`defineRule`](https://www.hyperfrontend.dev/docs/libraries/linter/#api-defineRule) and the rule types |
| [`/helpers`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/)      | Tokens, scopes, JSON properties and positions, for rules of your own                                                                             |
| [`/testing`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/)      | [`testRule`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/#api-testRule), which turns a rule's cases into `node:test` tests       |
| `hf-lint`                                                                       | The command line                                                                                                                                 |

Every rule, with its options and examples, is in the [rule catalogue](https://www.hyperfrontend.dev/docs/libraries/linter/rules/). Moving from ESLint? [Replace ESLint with @hyperfrontend/linter](https://www.hyperfrontend.dev/docs/guides/replace-eslint-with-hyperfrontend-linter/) starts with what does and does not carry over.

## Limitations

- No rule uses type information, and every packaged rule reads only the file it lints.
- No editor integration: run it from the terminal, a hook or CI.
- No result cache between runs.
- YAML files are read as plain lines for rules of your own; no packaged rule reads them.

## Acknowledgements

The packaged rules reimplement rules from [ESLint](https://eslint.org/), [typescript-eslint](https://typescript-eslint.io/), [eslint-plugin-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc), [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react), [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks) and [eslint-plugin-package-json](https://github.com/JoshuaKGoldberg/eslint-plugin-package-json), whose messages, options and test cases they follow. Their licences and the details are in [NOTICE.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/linter/NOTICE.md). How the linter came to be written is told in [I Replaced ESLint. The First Attempt Worked. I Threw It Away.](https://www.hyperfrontend.dev/articles/i-replaced-eslint-the-first-attempt-worked-i-threw-it-away/)

## Compatibility

Requires Node.js 24 or later, on Linux or Windows. There is no browser build.

<!-- hf:media start id="runtimes" scene="runtimes-linter" asset="runtimes" docs="#compatibility" alt="The runtimes @hyperfrontend/linter supports" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 24   |    ✅     |
| Modern Browsers |    ❌     |
| Web Workers     |    ❌     |

<!-- hf:media end -->

### Output Formats

| Format | File              | Tree-Shakeable |
| ------ | ----------------- | :------------: |
| ESM    | `index.mjs`       |       ✅       |
| CJS    | `index.cjs`       |       ❌       |
| Bin    | `bin/hf-lint.mjs` |       ❌       |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/linter)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
