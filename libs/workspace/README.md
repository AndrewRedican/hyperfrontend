# @hyperfrontend/workspace

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-workspace.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-workspace.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=workspace">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=workspace" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/workspace">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/workspace?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/workspace">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fworkspace?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/workspace">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/workspace?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/workspace/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/workspace-reach/hero.gif" alt="Five project tiles joined by the edges of their imports, each with its test task, under the command hf affected -t test. A file in core changes and the change travels every import that leaves core: it arrives at api through a value import and at cli through an import a spec makes, and both tasks light; it fades along the dashed type-only import to types, whose task stays dark; it carries on from api to web. A caption under the graph names the rule at each step, and the count beside selectAffected ends at 3 of 5">
  </a>
</p>

Runs the tasks of a TypeScript monorepo and releases its packages from a graph of what reaches what.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/workspace/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fworkspace)

## What is @hyperfrontend/workspace?

[`@hyperfrontend/workspace`](https://www.hyperfrontend.dev/docs/libraries/workspace/) is the `hf` command line for a TypeScript monorepo: it runs a project's tasks, runs only the tasks a change affects, scaffolds libraries and makes them publishable, and versions and publishes them from their commits. A workspace adds executors and generators of its own in TypeScript, listed in a manifest beside the project, with no build step.

It is one small tool a team can read end to end. It keeps no task cache and loads no plugins.

### Key Features

- **Affected analysis that explains itself** - every task a change selects or skips carries the rule and the file behind the decision
- **The package lifecycle as targets** - typecheck, test, build, e2e, publish, version-check and version, named once in `hf.json`
- **Generators that compose** - workspace, library, make-publishable, rename and move, callable by name from a generator of your own
- **Releases from commits** - the version flow reads conventional commits, pins dependents, writes the changelog and commits the bump
- **Lint rules on the graph** - module boundaries, dependency checks and shell command lines, for [`@hyperfrontend/linter`](https://www.hyperfrontend.dev/docs/libraries/linter/)
- **Your own executors and generators** - a TypeScript function and a schema, found through a manifest, run with the same command

### Architecture Highlights

The graph records each import with its kind and the role of the file that drew it, so a spec's import reaches the test target and not the build, a type-only import reaches neither test nor lint, and what cannot be followed precisely is counted whole and reported as such. The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/workspace/architecture/) covers the graph, the runner and how the entries are loaded by name.

## Why Use @hyperfrontend/workspace?

### Decisions you can read

A CI run that skipped a task says why, by rule and by file, and a lint rule that refuses an import names the constraint. When a selection is wrong, the output names the rule to revisit.

### Scaffold to publish in one tool

Generate a library, make it publishable with an e2e project that installs the packed tarball, type check and test it, version it from its commits and publish it, all through targets named once in `hf.json`.

### Extend it in TypeScript

A local executor is a function of its options and the task's context; a local generator is a function of a tree, and composes the packaged generators by name. Both load from source, without a compile step.

## Installation

```bash
npm install --save-dev @hyperfrontend/workspace
```

Requires Node.js 24 or later. The peers are optional, so install the ones the workspace uses: [`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/) for the test and e2e executors, [`@hyperfrontend/linter`](https://www.hyperfrontend.dev/docs/libraries/linter/) for the inferred lint target, prettier for the format command and the generators, and jsdom for the browser e2e suites.

## Quick Start

In a repository with a root `package.json`:

```bash
npx hf generate workspace
npx hf generate library my-utils --publishable
npx hf run my-utils:test
npx hf affected -t test --base=origin/main
```

The first command writes `hf.json` and the base configurations; the second writes a library with its project, manifest, configurations and e2e project; the rest run its tasks. [The commands](https://www.hyperfrontend.dev/docs/libraries/workspace/cli/) and [writing an executor or generator](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/) are each one page.

## API Overview

| Entry                                                                                                      | What it is                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`@hyperfrontend/workspace`](https://www.hyperfrontend.dev/docs/libraries/workspace/)                      | The contract: the types an executor or generator of your own is written against                   |
| [`/cli`](https://www.hyperfrontend.dev/docs/libraries/workspace/cli/)                                      | The command line as a function                                                                    |
| [`/runner`](https://www.hyperfrontend.dev/docs/libraries/workspace/runner/)                                | Executors and generators by name; one task, many in order, the affected run                       |
| [`/graph`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/)                                  | The workspace graph, its persisted state and the affected analysis                                |
| [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/workspace/hooks/)                                  | Loads a workspace's TypeScript from source, for scripts of your own                               |
| [`/lint`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/)                                    | The projects rule family and the readers a rule of your own shares with it                        |
| [`/generators`](https://www.hyperfrontend.dev/docs/libraries/workspace/generators/)                        | The helpers a local generator composes the packaged ones with; one entry per generator beneath it |
| [`/executors/build`](https://www.hyperfrontend.dev/docs/libraries/workspace/executors/build/) and siblings | One entry per executor, each with its schema                                                      |
| `hf`                                                                                                       | The command line                                                                                  |

## Limitations

- No task cache, local or remote: a task runs every time it is asked for.
- Target configurations (`--configuration`) are refused; a target has one shape.
- The graph reads TypeScript and JavaScript imports; a dependency carried only through another language is counted whole, as a fallback, and reported as such.
- The affected analysis of a historical range is exact only when the working tree is that range's head.

## Compatibility

Requires Node.js 24 or later. There is no browser build.

<!-- hf:media start id="runtimes" scene="runtimes-workspace" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 24 or later; not a target for evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 24   |    ✅     |
| Modern Browsers |    ❌     |
| Web Workers     |    ❌     |

<!-- hf:media end -->

| Operating System | Supported |
| ---------------- | :-------: |
| Linux            |    ✅     |
| macOS            |    ✅     |
| Windows          |    ✅     |

### Output Formats

| Format | File         | Tree-Shakeable |
| ------ | ------------ | :------------: |
| ESM    | `index.mjs`  |       ✅       |
| CJS    | `index.cjs`  |       ❌       |
| Bin    | `bin/hf.mjs` |       ❌       |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/workspace)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
