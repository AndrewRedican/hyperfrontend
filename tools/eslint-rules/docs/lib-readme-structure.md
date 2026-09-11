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
   - Must include a **Key Features** subsection, whose list is checked in full (see below)
   - May include an **Architecture Highlights** subsection; it is optional
2. **Why Use @hyperfrontend/<name>?** - Value proposition
3. **Installation** - Installation instructions
4. **Quick Start** - Quick start guide
5. **API Overview** - API documentation
6. **Compatibility** - Platform/environment compatibility

**Architecture Highlights** is optional on purpose. A package whose internals hold nothing a
consumer needs to know should not be made to invent an architecture story to satisfy a
linter, and an invented one is worse than none.

### Key Features

The documentation site renders this list as the package's feature summary: it reads each bold
label as the feature's name and the text after it as the reason the feature matters. The rule
holds the list to that shape.

| Check              | Requirement                                                          | Message                                   |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------- |
| Flat list          | Every line is a `-` or `*` bullet at column zero, or an HTML comment | `keyFeaturesNotAList`                     |
| Bold label         | Every bullet opens with `- **Label**`                                | `keyFeatureMissingLabel`                  |
| Explanation        | Something follows the label                                          | `keyFeatureMissingDescription`            |
| Label length       | The label is at most 48 characters                                   | `keyFeatureLabelTooLong`                  |
| Explanation length | The explanation is at least 20 characters                            | `keyFeatureDescriptionTooShort`           |
| List length        | The list holds between 3 and 12 features                             | `keyFeaturesTooFew`, `keyFeaturesTooMany` |

Each of these reports points at the line it is about, so the editor lands on the bullet rather
than on the top of the file.

A lead-in paragraph, a nested bullet, a table or a fenced block has nowhere to render, so none
of them may sit in the section; a fenced block is reported once rather than once per line
inside it. An HTML comment is left alone, since a README parks an asset note inside the list
the note belongs to.

The explanation may be introduced by a colon or a dash, or may continue the label as a clause:
`- **Value picker** for cyclical iteration` reads better than the same sentence with
punctuation forced into the middle of it, and both leave the reader the same explanation.

The bounds are set from the READMEs already published: their lists run from 5 to 11 features,
their longest label is 36 characters and their shortest explanation is 22, so the limits catch
a list that has stopped being a summary rather than one that is merely long.

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

A Key Features section that is not a flat list of labelled features:

```markdown
### Key Features

This package gives you:

- **Fast** - it is fast
- Works everywhere the platform works
- **Everything this package does for you and then some more** - explained here
  - and a detail hanging off the bullet above

| Feature | Why |
| ------- | --- |
```

Every line here draws a report: the lead-in paragraph and the two table lines are not bullets,
`Fast` is explained in ten characters, the second bullet carries no label, the third wears a
sentence as its label, and the detail hanging off it is nested.

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

- **Feature One** - Description of feature one and what it does for you
- **Feature Two** - Description of feature two and what it does for you
- **Feature Three**: Description of feature three and what it does for you

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

A README that has no architecture worth stating leaves the **Architecture Highlights** section
out entirely and still passes.

## When Not To Use It

- If you have a different README structure standard
- For non-publishable libraries or applications
- For workspace-internal libraries that don't need public documentation

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md)
- [lib-project-bundle-config](./lib-project-bundle-config.md)
- [lib-pkg-fields](./lib-pkg-fields.md)
