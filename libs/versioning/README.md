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

<!-- hf:media start id="banner" scene="banner-versioning" asset="banner" alt="@hyperfrontend/versioning" -->
<!-- hf:media end -->

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/versioning/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/versioning-cascade/hero.gif" alt="One commit header, feat(api)!: drop v1, typed at the top of a cascade; its parts fall into type, scope, breaking and subject tiles, feat and true converge into a major bump, the version 2.4.1 rolls to 3.0.0, and the changelog line assembles from the tiles, with the package function that performs each step named beside the row it produces">
  </a>
</p>

Versioning library with changelog parsing, conventional commits, and semver flow orchestration.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/versioning/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fversioning)

## What is @hyperfrontend/versioning?

@hyperfrontend/versioning provides a comprehensive toolkit for managing software versioning in JavaScript/TypeScript projects. The library is built on a **purely functional architecture** with factory functions, immutable data structures, and composable operations.

### Key Features

- **Interactive Commit Author ([`cz`](https://www.hyperfrontend.dev/docs/libraries/versioning/bin/))** - `npx cz` launches a keystroke-live conventional-commit session (type, scope, subject countdown, body, breaking marker, issues, preview, commit) with clipboard-paste support and terminal-resize redraw
- **Commit Validator ([`cl`](https://www.hyperfrontend.dev/docs/libraries/versioning/bin/))** - `npx cl <path>` plugs into any `commit-msg` git hook to enforce your ruleset
- **[Changelog Parsing](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/parse/)** - Parse CHANGELOG.md files into structured objects with lossless round-tripping
- **[Conventional Commits](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/)** - Parse, validate, format, and classify messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification
- **[Semver Utilities](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/)** - Parse, compare, increment, and validate [semantic versions](https://semver.org/)
- **[Registry Client](https://www.hyperfrontend.dev/docs/libraries/versioning/registry/)** - Query [npm](https://www.npmjs.com/) registry for published versions and package metadata
- **[Compare URLs](https://www.hyperfrontend.dev/docs/libraries/versioning/repository/)** - Generate platform-specific compare URLs for changelog entries ([GitHub](https://github.com/), [GitLab](https://about.gitlab.com/), [Bitbucket](https://bitbucket.org/), [Azure DevOps](https://azure.microsoft.com/en-us/products/devops))
- **[Monorepo Scope Filtering](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/classify/)** - Intelligent commit classification ensures changelogs only include relevant commits
- **[Composable Operations](https://www.hyperfrontend.dev/docs/libraries/versioning/flow/)** - Build complex versioning workflows from simple, pure functions
- **Zero External Dependencies** - Self-contained implementation with no third-party runtime dependencies

### Architecture Highlights

Parsing is bounded and predictable: every parser is a character-by-character state machine rather than a regular expression, so no input pattern can trigger catastrophic backtracking. Each entry point also rejects oversized input before processing it (10,000 characters for a commit message, 1 MB for a changelog file, 256 for a version string, 214 for a package name).

👉 See the [architecture guide](https://www.hyperfrontend.dev/docs/libraries/versioning/architecture/) for detailed design principles, data flow diagrams, and module composition.

## Why Use @hyperfrontend/versioning?

### Type-Safe Changelog Manipulation

Working with CHANGELOG.md files programmatically typically involves fragile string manipulation. This library parses changelogs into fully typed data structures with factory functions for creating entries, sections, and items. Modify changelog content with confidence using immutable operations and round-trip safely back to markdown.

### Unified Versioning Primitives

Version management requires coordinating [semver](https://semver.org/) parsing, commit analysis, changelog generation, and registry queries. This library provides all these primitives in one cohesive package with consistent APIs. Query [npm](https://www.npmjs.com/) for published versions, parse commit history, calculate version bumps, and generate changelog entries, all composable into custom release workflows.

### Zero-Dependency CI Integration

Designed for automated pipelines where minimal attack surface matters. Zero external runtime dependencies and state-machine parsing ensure predictable performance on any input. All parsers enforce input length limits to prevent resource exhaustion.

### One-Stop Commit Toolchain

The interactive [`cz`](https://www.hyperfrontend.dev/docs/libraries/versioning/bin/) and validator [`cl`](https://www.hyperfrontend.dev/docs/libraries/versioning/bin/) bins cover the same ground as [commitizen](https://github.com/commitizen/cz-cli) + [cz-conventional-changelog](https://github.com/commitizen/cz-conventional-changelog) + [@commitlint/cli](https://github.com/conventional-changelog/commitlint), in one package, without patch-package workarounds, with a config-driven session (`commit.config.{js,mjs,cjs}`), a live 72-char header countdown, and scope choices derived from staged files. Acknowledgment to those projects: they shaped the conventions this library now implements natively.

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
console.log(commit.scope) // ['api'], an array because `feat(a,b): x` names two
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

The package publishes one subpath per concern, and the name of the import is the job it does. [`commits`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/) parses, validates, classifies and authors conventional commit messages. [`changelog`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/operations/#api-MergeResult-prop-changelog) reads and writes CHANGELOG.md. [`semver`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/) parses, compares and increments versions and ranges. [`git`](https://www.hyperfrontend.dev/docs/libraries/versioning/git/), [`registry`](https://www.hyperfrontend.dev/docs/libraries/versioning/registry/) and [`workspace`](https://www.hyperfrontend.dev/docs/libraries/versioning/workspace/) cover the three things a release has to ask the world outside the process: the repository, the npm registry, and the packages on disk. [`repository`](https://www.hyperfrontend.dev/docs/libraries/versioning/repository/) turns a remote URL into the compare links a changelog entry carries. [`flow`](https://www.hyperfrontend.dev/docs/libraries/versioning/flow/) composes the rest into a release. The root entry re-exports all of them.

[`parseConventionalCommit`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/#api-parseConventionalCommit) is where most work starts: hand it the raw message and it returns a [`ConventionalCommit`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit) carrying [`type`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit-prop-type), [`subject`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit-prop-subject), [`breaking`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit-prop-breaking), the parsed [`footers`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit-prop-footers) and a [`scope`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit-prop-scope) that is a `readonly string[]` rather than a string, because `feat(a,b): x` names two. Its [`type`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit-prop-type) and [`breaking`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/models/#api-ConventionalCommit-prop-breaking) go to [`getSemverBump`](https://www.hyperfrontend.dev/docs/libraries/versioning/commits/#api-getSemverBump), which answers [`major`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/models/#api-BumpType), [`minor`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/models/#api-BumpType), [`patch`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/models/#api-BumpType) or [`none`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/models/#api-BumpType), and that answer plus a parsed version goes to [`increment`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/#api-increment). All three are pure functions over plain data.

[`parseChangelog`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/#api-parseChangelog) turns a CHANGELOG.md into an addressable tree of entries, sections and items, and [`serializeChangelog`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/#api-serializeChangelog) writes that tree back to markdown, so a file read and rewritten unedited comes back as itself. Those parsers, and the commit parsers beside them, are hand-written character state machines rather than regular expressions, and each refuses oversized input before it begins, which is why no pathological changelog can stall a release job.

Two bins ship alongside the API, and neither asks you to import anything: `npx cz` runs the interactive session that authors a conventional commit, and `npx cl <path>` validates one message from a `commit-msg` hook. For unattended releases, [`createConventionalFlow`](https://www.hyperfrontend.dev/docs/libraries/versioning/flow/#api-createConventionalFlow) assembles the ordered steps (fetch the published version, analyse commits, calculate the bump, generate the changelog entry, update package.json, write, commit, tag) and [`executeFlow`](https://www.hyperfrontend.dev/docs/libraries/versioning/flow/#api-executeFlow) runs them against a virtual file system, so a dry run reports the whole diff without touching disk.

Every model, option, step and outcome type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/versioning/#api-reference).

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-versioning" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later; not a target for evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ❌     |
| Web Workers     |    ❌     |

<!-- hf:media end -->

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

- Uses [@hyperfrontend/questions](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/questions) to power the interactive [`cz`](https://www.hyperfrontend.dev/docs/libraries/versioning/bin/) authoring session
- Works seamlessly with [@hyperfrontend/project-scope](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/project-scope) for virtual file system operations
- Looking for cryptographic utilities? See [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography)

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
