# lib-readme-structure

Ensure publishable library README.md files have required structure and sections.

## Rule Details

This rule validates that README.md files in publishable libraries follow the standard hyperfrontend documentation structure. It checks for:

### Title

- Must be in format `# @hyperfrontend/<package-name>`

### Badges Block

Must include the following badges in a centered paragraph block:

| Badge          | Pattern                        |
| -------------- | ------------------------------ |
| Build          | GitHub Actions workflow status |
| Coverage       | Codecov badge                  |
| npm version    | npm version badge              |
| Bundle size    | Bundlephobia badge             |
| Contributors   | All-contributors badge         |
| License        | MIT license badge              |
| npm downloads  | npm downloads badge            |
| GitHub stars   | GitHub stars badge             |
| Node version   | Node.js version badge          |
| Tree-shakeable | Tree-shakeable indicator       |

### Short Description

A short descriptive paragraph must appear after the badges block.

### Documentation Link

Must include a documentation link in format:

```
• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/<name>/)
```

### Guides Link

Must also link the package's guides and tutorials, filtered to this package:

```
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=<url-encoded package name>)
```

The package name is read from `package.json`, so the link is checked against the
package the README actually ships with rather than the title text. The value is
URL-encoded exactly as the site's own filter controls encode it
(`%40hyperfrontend%2Fnexus`), so a link shared from the site and a link written
in a README are the same URL.

The link addresses a filter, not a list of guide slugs, which is the point: a
package with no guides yet still gets a working link, and guides written later
surface from the already-published README without another release. The filtered
page has a deliberate empty state that invites a guide request.

When a project has no `package.json`, this check is skipped: without a package
name there is nothing to filter on. `lib-pkg-fields` is the rule that requires
the field.

### Required Sections (in order)

1. **What is @hyperfrontend/<name>?** - Library description
   - Must include **Key Features** subsection with bullet list (`- **Feature** - Description`)
   - Must include **Architecture Highlights** subsection
2. **Why Use @hyperfrontend/<name>?** - Value proposition
3. **Installation** - Installation instructions
4. **Quick Start** - Quick start guide
5. **API Overview** - API documentation
6. **Compatibility** - Platform/environment compatibility

### Why?

- **Consistency**: All libraries should have the same documentation structure
- **Discoverability**: Standard badges help users quickly assess library quality
- **Completeness**: Required sections ensure comprehensive documentation
- **Onboarding**: Consistent structure makes it easier for contributors to understand and update docs

## Examples

### ❌ Incorrect

Missing title format:

```markdown
# My Library

...
```

Missing badges block:

```markdown
# @hyperfrontend/utils

No badges here.

## What is @hyperfrontend/utils?

...
```

Missing required sections:

```markdown
# @hyperfrontend/utils

<p align="center">
  ...badges...
</p>

Description.

## Installation

npm install
```

Sections out of order:

```markdown
# @hyperfrontend/utils

...

## Installation

npm install

## What is @hyperfrontend/utils?

Should come before Installation.
```

### ✅ Correct

```markdown
# @hyperfrontend/utils

<p align="center">
  <a href="...">
    <img src="https://img.shields.io/github/actions/workflow/status/..." alt="Build">
  </a>
  <a href="https://codecov.io/gh/...">
    <img src="https://codecov.io/gh/.../badge.svg" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/utils" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Futils" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/..." alt="All Contributors">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/utils" alt="npm downloads">
  </a>
  <a href="https://github.com/...">
    <img src="https://img.shields.io/github/stars/..." alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success" alt="Tree Shakeable">
</p>

Utility functions for common operations.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/)

• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Futils)

## What is @hyperfrontend/utils?

Description of the library.

### Key Features

- **Feature One** - Description of feature one
- **Feature Two** - Description of feature two

### Architecture Highlights

Built on functional composition with dependency injection.

## Why Use @hyperfrontend/utils?

Value proposition and use cases.

## Installation

\`\`\`bash
npm install @hyperfrontend/utils
\`\`\`

## Quick Start

\`\`\`typescript
import { utility } from '@hyperfrontend/utils'
\`\`\`

## API Overview

### Main Functions

- **`utility()`** - Does something useful

## Compatibility

| Platform | Support |
| -------- | :-----: |
| Browser  |   ✅    |
| Node.js  |   ✅    |
```

## When Not To Use It

- If you have a different README structure standard
- For non-publishable libraries or applications
- For workspace-internal libraries that don't need public documentation

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md)
- [lib-project-bundle-config](./lib-project-bundle-config.md)
- [lib-pkg-fields](./lib-pkg-fields.md)
