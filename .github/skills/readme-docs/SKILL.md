---
name: readme-docs
version: 1.0.0
description: Write README.md files for hyperfrontend libraries and sub-modules. Use when creating library documentation, writing sub-module READMEs, documenting API tables, adding quick start guides, or reviewing README structure compliance.
---

# README Docs

Create README.md files—library root for consumers, sub-module for maintainers.

---

## Reference Locations

| Item              | Path                                 |
| ----------------- | ------------------------------------ |
| Library README    | `libs/<name>/README.md`              |
| Sub-module README | `libs/<name>/src/<module>/README.md` |
| ESLint rule       | `lib-readme-structure`               |

---

## Document Types

| Type              | Location                          | Audience    | Focus                            |
| ----------------- | --------------------------------- | ----------- | -------------------------------- |
| Library README    | `libs/<name>/README.md`           | Consumers   | Value prop, install, quick start |
| Sub-module README | `libs/<name>/src/<mod>/README.md` | Maintainers | API tables, implementation links |

---

## Library README Structure

**Required sections (in order):**

1. `## What is @hyperfrontend/<name>?`
   - `### Key Features`
   - `### Architecture Highlights`
2. `## Why Use @hyperfrontend/<name>?`
3. `## Installation`
4. `## Quick Start`
5. `## API Overview`
6. `## Compatibility`

**Required badges:**

```markdown
[![Build](https://github.com/AndrewRedican/hyperfrontend/actions/workflows/core-ci.yml/badge.svg)](...)
[![Coverage](https://codecov.io/gh/AndrewRedican/hyperfrontend/branch/main/graph/badge.svg?flag=<name>)](...)
[![npm version](https://img.shields.io/npm/v/@hyperfrontend/<name>)](...)
[![npm downloads](https://img.shields.io/npm/dm/@hyperfrontend/<name>)](...)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@hyperfrontend/<name>)](...)
[![All Contributors](https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?...)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](...)
[![Node Version](https://img.shields.io/node/v/@hyperfrontend/<name>)](...)
[![Tree-Shakeable](https://img.shields.io/badge/tree--shakeable-yes-brightgreen)](...)
```

**Required links:**

```markdown
• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/<name>/)
• 👉 See [**roadmap**](https://github.com/AndrewRedican/hyperfrontend/blob/main/roadmap/<name>/)
```

---

## Sub-Module README Structure

````markdown
# ModuleName

Brief one-sentence purpose.

**Navigation**: [↑ parent/](../README.md) · [← sibling](../sibling/README.md) · [→ other](../other/README.md)

## Overview

[Optional Mermaid diagram for complex modules]

## API

| Export        | Description   | Implementation         |
| ------------- | ------------- | ---------------------- |
| `createFoo()` | Creates a Foo | [foo.ts](./foo.ts)     |
| `parseFoo()`  | Parses Foo    | [parse.ts](./parse.ts) |

## Key Interfaces

```typescript
interface FooConfig {
  option: string
}
```
````

````

**Navigation arrows:**

| Arrow | Meaning            | Example                             |
| ----- | ------------------ | ----------------------------------- |
| `↑`   | Parent directory   | `[↑ lib/](../README.md)`           |
| `←`   | Previous sibling   | `[← sender](../sender/README.md)`  |
| `→`   | Next sibling       | `[→ receiver](../receiver/README.md)` |
| `↔`   | Bidirectional      | `[↔ protocol](../protocol/README.md)` |

---

## Validation

```bash
npx nx lint <project>
````

ESLint rule `lib-readme-structure` enforces library README structure.

---

## Checklist

**Library README:**

- [ ] All required badges present
- [ ] Required sections in correct order
- [ ] Documentation and roadmap links present
- [ ] Consumer-facing content only
- [ ] Passes `npx nx lint <project>`

**Sub-module README:**

- [ ] One-line purpose statement
- [ ] Navigation links with arrows
- [ ] API table linking to implementation files
- [ ] Key interfaces documented
- [ ] No installation/external examples
