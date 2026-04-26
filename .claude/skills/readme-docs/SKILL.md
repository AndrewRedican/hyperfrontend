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
| Library ESLint    | `lib-readme-structure`               |
| Submodule ESLint  | `docs-site-secondary-entries`        |

---

## Document Types

| Type              | Location                          | Audience  | Focus                                  |
| ----------------- | --------------------------------- | --------- | -------------------------------------- |
| Library README    | `libs/<name>/README.md`           | Consumers | Value prop, install, quick start       |
| Sub-module README | `libs/<name>/src/<mod>/README.md` | Consumers | Intent, design, examples — NO API list |

The sub-module page renders this README plus an auto-generated scoped API reference. Manual API tables would duplicate the rendered ref.

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

**Required (the floor):**

```markdown
# moduleName

One-sentence statement of what this module does and why it exists.
```

**Optional sections** — add when the module's complexity warrants them:

| Section            | When to add                                     |
| ------------------ | ----------------------------------------------- |
| `## Overview`      | Multi-step pipelines, mermaid diagrams          |
| `## Usage`         | Composition examples beyond a single signature  |
| `## Configuration` | User-facing config knobs that need explanation  |
| Semantic tables    | Taxonomies, decision rules, behavior contracts  |
| Mermaid diagram    | Data flow, state machines, dependency relations |
| `## Design`        | Trade-offs, invariants, "why this and not that" |

**Do NOT include:**

- `## API` table listing exports (the page renders this automatically below your README).
- "Key Interfaces" code blocks duplicating typedoc-extractable types.
- Installation, npm install commands (consumer-facing — belongs in library README).

---

## Validation

```bash
npx nx lint <project>
```

| Rule                          | Enforces                                                  |
| ----------------------------- | --------------------------------------------------------- |
| `lib-readme-structure`        | Library-root README sections, badges, links               |
| `docs-site-secondary-entries` | Every secondary entrypoint has a `page.tsx` + sidebar nav |
| `docs-site-library-docs`      | Every library README has a corresponding docs-site page   |

---

## Checklist

**Library README:**

- [ ] All required badges present
- [ ] Required sections in correct order
- [ ] Documentation and roadmap links present
- [ ] Consumer-facing content only
- [ ] Passes `npx nx lint <project>`

**Sub-module README:**

- [ ] H1 matches the module folder name
- [ ] One-sentence purpose under the H1
- [ ] No manual API table — page renders the scoped API ref automatically
- [ ] No installation / npm commands
- [ ] Optional sections only when complexity warrants them
