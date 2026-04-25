# @hyperfrontend/versioning

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-versioning.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-versioning.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=versioning">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=versioning" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/versioning">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/versioning?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/versioning">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fversioning?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/versioning">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/versioning?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Versioning library with changelog parsing, conventional commits, and semver flow orchestration.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/versioning/)
• 👉 See [**roadmap**](https://github.com/AndrewRedican/hyperfrontend/blob/main/roadmap/versioning/)

## What is @hyperfrontend/versioning?

@hyperfrontend/versioning provides a comprehensive toolkit for managing software versioning in JavaScript/TypeScript projects. The library is built on a **purely functional architecture** with factory functions, immutable data structures, and composable operations.

### Key Features

- **Interactive Commit Author (`cz`)** - `npx cz` launches a keystroke-live conventional-commit session (type, scope, subject countdown, body, breaking marker, issues, preview, commit)
- **Commit Validator (`cl`)** - `npx cl <path>` plugs into any `commit-msg` git hook to enforce your ruleset
- **Changelog Parsing** - Parse CHANGELOG.md files into structured objects with lossless round-tripping
- **Conventional Commits** - Parse, validate, format, and classify messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification
- **Semver Utilities** - Parse, compare, increment, and validate [semantic versions](https://semver.org/)
- **Registry Client** - Query [npm](https://www.npmjs.com/) registry for published versions and package metadata
- **Compare URLs** - Generate platform-specific compare URLs for changelog entries ([GitHub](https://github.com/), [GitLab](https://about.gitlab.com/), [Bitbucket](https://bitbucket.org/), [Azure DevOps](https://azure.microsoft.com/en-us/products/devops))
- **Monorepo Scope Filtering** - Intelligent commit classification ensures changelogs only include relevant commits
- **Composable Operations** - Build complex versioning workflows from simple, pure functions
- **Zero External Dependencies** - Self-contained implementation with no third-party runtime dependencies

### Architecture Highlights

Built on a purely functional architecture with factory functions and immutable data structures. All parsing uses character-by-character state machines for predictable O(n) performance. The library integrates with `@hyperfrontend/project-scope` for virtual file system operations and `@hyperfrontend/data-utils` for deep comparison.

👉 See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design principles, data flow diagrams, and module composition.

## Why Use @hyperfrontend/versioning?

### Type-Safe Changelog Manipulation

Working with CHANGELOG.md files programmatically typically involves fragile string manipulation. This library parses changelogs into fully typed data structures with factory functions for creating entries, sections, and items. Modify changelog content with confidence using immutable operations and round-trip safely back to markdown.

### Unified Versioning Primitives

Version management requires coordinating [semver](https://semver.org/) parsing, commit analysis, changelog generation, and registry queries. This library provides all these primitives in one cohesive package with consistent APIs. Query [npm](https://www.npmjs.com/) for published versions, parse commit history, calculate version bumps, and generate changelog entries — all composable into custom release workflows.

### Zero-Dependency CI Integration

Designed for automated pipelines where minimal attack surface matters. Zero external runtime dependencies and state-machine parsing ensure predictable performance on any input. All parsers enforce input length limits to prevent resource exhaustion.

### One-Stop Commit Toolchain

The interactive `cz` and validator `cl` bins cover the same ground as [commitizen](https://github.com/commitizen/cz-cli) + [cz-conventional-changelog](https://github.com/commitizen/cz-conventional-changelog) + [@commitlint/cli](https://github.com/conventional-changelog/commitlint) — in one package, without patch-package workarounds, with a config-driven session (`commit.config.{js,mjs,cjs}`), a live 72-char header countdown, and scope choices derived from staged files. Acknowledgment to those projects: they shaped the conventions this library now implements natively.

## Installation

```bash
npm install @hyperfrontend/versioning
```

## Quick Start

### Parsing a Changelog

```typescript
import { parseChangelog } from '@hyperfrontend/versioning'
import fs from 'fs'

// Parse existing changelog content
const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
const changelog = parseChangelog(content)

// Access entries
for (const entry of changelog.entries) {
  console.log(`Version ${entry.version} - ${entry.date}`)
  for (const section of entry.sections) {
    console.log(`  ${section.heading}: ${section.items.length} changes`)
  }
}

// Access metadata
// Formats: 'keep-a-changelog' (https://keepachangelog.com), 'conventional', etc.
console.log(changelog.metadata.format)
```

### Parsing Conventional Commits

```typescript
import { parseConventionalCommit } from '@hyperfrontend/versioning'

const commit = parseConventionalCommit('feat(api): add user authentication')

console.log(commit.type) // 'feat'
console.log(commit.scope) // 'api'
console.log(commit.subject) // 'add user authentication'
console.log(commit.breaking) // false
```

### Checking for Breaking Changes

```typescript
import { parseConventionalCommit } from '@hyperfrontend/versioning'

// Breaking change via !
const commit1 = parseConventionalCommit('feat(api)!: remove deprecated endpoint')
console.log(commit1.breaking) // true

// Breaking change via footer
const commit2 = parseConventionalCommit(\`fix: update API response format

BREAKING CHANGE: Response structure has changed\`)
console.log(commit2.breaking) // true
console.log(commit2.breakingDescription) // 'Response structure has changed'
```

## API Overview

### Changelog Models

- **Changelog** - Complete representation of a CHANGELOG.md file
- **ChangelogEntry** - A single version entry with date and sections
- **ChangelogSection** - A category of changes (Features, Bug Fixes, etc.)
- **ChangelogItem** - An individual change with description and references

### Commit Models

- **ConventionalCommit** - Parsed conventional commit message
- **CommitType** - Type constants (feat, fix, docs, etc.)
- **CommitFooter** - Parsed footer/trailer from commit message

### Parser Functions

- **parseChangelog(content: string)** - Parse markdown changelog content
- **parseConventionalCommit(message: string)** - Parse a commit message
- **tokenize(input: string)** - Low-level tokenizer for changelog content

## Module Documentation

| Module        | Description                             | Documentation                        |
| ------------- | --------------------------------------- | ------------------------------------ |
| `changelog/`  | Parse and manipulate CHANGELOG.md files | [README](./src/changelog/README.md)  |
| `commits/`    | Parse conventional commit messages      | [README](./src/commits/README.md)    |
| `semver/`     | Semantic version parsing and comparison | [README](./src/semver/README.md)     |
| `registry/`   | npm registry client                     | [README](./src/registry/README.md)   |
| `git/`        | Git operations abstraction              | [README](./src/git/README.md)        |
| `workspace/`  | Project discovery and package.json      | [README](./src/workspace/README.md)  |
| `flow/`       | Version release workflow orchestration  | [README](./src/flow/README.md)       |
| `repository/` | Repository detection and compare URLs   | [README](./src/repository/README.md) |

👉 See [ARCHITECTURE.md](./ARCHITECTURE.md) for module composition diagrams and data flow.

## Compatibility

| Platform | Support |
| -------- | :-----: |
| Node.js  |   ✅    |
| Browser  |   ❌    |

### Output Formats

| Format | File           | Tree-Shakeable |
| ------ | -------------- | :------------: |
| ESM    | `index.esm.js` |       ✅       |
| CJS    | `index.cjs.js` |       ❌       |

## Security

All parsers use state-machine tokenization with O(n) complexity and enforce input length limits (commit messages: 10KB, changelog files: 1MB) to prevent resource exhaustion. Character-by-character parsing eliminates regex-based vulnerabilities.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/versioning)**

- Uses [@hyperfrontend/questions](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/questions) to power the interactive `cz` authoring session
- Works seamlessly with [@hyperfrontend/project-scope](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/project-scope) for virtual file system operations
- Looking for cryptographic utilities? See [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography)

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
