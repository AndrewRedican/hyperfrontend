# README Docs: Structure Reference

The mechanics a README must satisfy. Lint enforces everything in the first table; the rest is convention the siblings share. Read `SKILL.md` first for what a README is for. Examples use `@hyperfrontend/testing`.

---

## What Is Enforced

Each rule is an error. `lint.base.config.ts` turns on the workspace rules, `codeblock-line-width` and `no-ascii-art-diagrams`; `tools/lint/config/documentation-scopes.ts` turns on the other three packaged rules. Rule documents sit in `libs/linter/docs/rules/` for the five packaged rules and in `tools/lint/docs/rules/` for the rest.

| Rule                             | Holds                                                                     | Applies to                             |
| -------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| `lib-readme-structure`           | Title, ten badges, description, the two links, required sections in order | Package README                         |
| `lib-pkg-description`            | Manifest `description` mirrors the README's description line              | Package README and `package.json`      |
| `lib-readme-compatibility-table` | Runtime and operating-system tables match `metadata.compatibility`        | Package README                         |
| `lib-readme-media-regions`       | Media regions and the banner are recorded                                 | Package README                         |
| `readme-media-asset`             | Media URLs name assets that exist                                         | Every README but the root's            |
| `lib-inline-code-links`          | Inline code names link to validated targets                               | Every markdown of a published library  |
| `markdown-example-api`           | A fenced example imports what a package exports and calls what it imports | Every markdown but rule documents      |
| `readme-paragraph-length`        | A paragraph renders to 700 characters or fewer                            | Root README, published-library READMEs |
| `require-codeblock-language`     | Every fenced block names its language                                     | Root markdown, published-library root  |
| `no-manual-table-of-contents`    | No hand-written table of contents                                         | Every markdown under `libs/`           |
| `codeblock-line-width`           | No code line that is wide only because a list is crammed onto it          | Every markdown                         |
| `no-ascii-art-diagrams`          | Diagrams are mermaid, not drawn in characters                             | Every markdown                         |
| `lib-pkg-secondary-entry-readme` | Each entry point of a package has a sub-module README                     | Package source                         |
| `docs-site-library-docs`         | Each markdown file of a published library has a docs page                 | Docs site                              |
| `docs-site-secondary-entries`    | Each entry point has a docs page                                          | Docs site                              |
| `root-readme-packages`           | The root README lists every published package                             | Root README                            |

Convention, not lint: `## Part of hyperfrontend` in every package README, `### Architecture Highlights` and `## Limitations` where a package has something to say there, no em dashes, and everything `SKILL.md` calls editorial.

The `library` and `make-publishable` generators write a four-part stub (title, description, Installation, Usage). A published package's README is completed by hand from a sibling.

---

## Section Jobs

| Section                 | Its job                                                     |
| ----------------------- | ----------------------------------------------------------- |
| Description line        | One idea, no feature list                                   |
| What is                 | What it is, then what it is not or who it is for            |
| Key Features            | What the reader gains, one clause each                      |
| Architecture Highlights | Guarantees a consumer relies on, then the architecture link |
| Why Use                 | The reasons to choose it, each made once                    |
| Installation            | The command and any peer                                    |
| Quick Start             | The shortest example that runs, and how to run it           |
| API Overview            | The entry points and a link to the reference                |
| Limitations             | What would change an adoption decision, then a link         |
| Compatibility           | The floor in a sentence, then the generated tables          |
| Part of hyperfrontend   | The monorepo line, the docs link, related packages          |

Depth follows the package: a protocol earns more words than a string helper. A section a package has nothing to say in is left out, not invented.

---

## Library README Layout

In order:

1. `# @hyperfrontend/testing` (the build replaces it with the banner GIF in the dist README)
2. Badges block: two `<p align="center">` paragraphs of shields, copied from a sibling README
3. Optional hero: a centred `<a><img width="640" height="360" ...></a>` linking to the docs page
4. The description line
5. The two links:

```markdown
• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/testing/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Ftesting)
```

A utility package's page sits one level down: `https://www.hyperfrontend.dev/docs/libraries/utils/list/` for `@hyperfrontend/list-utils`.

6. Required `##` sections, in this order (others may sit between them):
   - `## What is @hyperfrontend/testing?` with `### Key Features` (required) and `### Architecture Highlights` (optional)
   - `## Why Use @hyperfrontend/testing?`
   - `## Installation`
   - `## Quick Start`
   - `## API Overview`
   - `## Compatibility`
7. `## Part of hyperfrontend`
8. `## License`

`## Limitations` sits between API Overview and Compatibility. A new README states its floor and caveats in the Compatibility lead sentence, not in a separate `## Requirements` section.

### Badges

`lib-readme-structure` requires ten, matched by URL: build (`/github/actions/workflow/status`), coverage (`codecov.io`), npm version (`/npm/v/`), bundle size (`bundlephobia.com`), contributors (`/all-contributors`, inside the `ALL-CONTRIBUTORS-BADGE` markers), license (`/license-MIT`), downloads (`/npm/dm/`), stars (`/github/stars`), node version (`node-%3E%3D`), tree shakeable (`tree%20shakeable`). Copy the block from a sibling and change the package name, workflow file and coverage flag.

### Description line

The first paragraph after the badges block that does not start with `<`. `lib-pkg-description` mirrors it into `package.json` `description`; write it in the README and let `--fix` copy it. Offer 3 to 4 candidates with different angles before settling one.

The banner does not read it: every package has a `TAGLINES` entry and the description is only the fallback. Update the entry when the description's idea changes, and keep it to two banner lines (preview it; a third line means rewrite, never shrink the type).

### Key Features

A flat list of 3 to 12 bullets, each opening `- **Label**` or `- **[Label](url)**` and continuing after a dash, a colon, or as a clause (`- **Value picker** for cyclical iteration`). Label 48 characters or fewer, explanation at least 20. Nothing else may sit in the section. The docs site renders a correct list as a marked run and falls back to plain bullets otherwise.

### Architecture Highlights

Optional on purpose: the rule's document calls an invented one worse than none. The docs site renders it as a margin note at the end of the page.

### Compatibility

The runtime table is wrapped in an `hf:media` region and generated from `metadata.compatibility` in `project.json`:

```markdown
<!-- hf:media start id="runtimes" scene="runtimes-testing" asset="runtimes" docs="#compatibility" alt="..." -->

| Environment | Supported |
| ----------- | :-------: |
| ...         |    ...    |

<!-- hf:media end -->

| Operating System | Supported |
| ---------------- | :-------: |
| Linux            |    ✅     |
| macOS            |    ✅     |
| Windows          |    ✅     |
```

`lib-readme-compatibility-table` fixes drift in both tables and adds a missing operating-system table; the build swaps the region for the recorded runtime strip in the dist README only, so the operating-system table sits outside it. `### Output Formats` and `### Peer Dependencies` tables follow when they apply.

### Inline code and API links

`lib-inline-code-links` reads every inline code span and resolves names from the workspace itself, so the fixer and the validator agree on the destination.

| Mention                                | Destination                                          |
| -------------------------------------- | ---------------------------------------------------- |
| `@hyperfrontend/testing`               | The package's landing page                           |
| `/hooks`, or the full entry name       | The entry point's page                               |
| An export                              | `#api-<Symbol>` on the deepest entry that exports it |
| An export with browser and node twins  | `#api-<Symbol>` on the landing page                  |
| An interface or class property         | `#api-<Type>-prop-<member>`                          |
| A class method                         | `#api-<Type>-method-<member>`                        |
| Any other member                       | `#api-<Type>`                                        |
| A bundle global                        | The page of the entry the bundle exposes             |
| A declaration the package keeps inside | The declaring source file on GitHub                  |

Values are exempt: literals, quoted strings, numbers, keywords, flags, command lines, file names, paths, hyphenated enum values, any span with punctuation in it (`has()`, `channel.stop()`) and platform globals such as `postMessage`.

A name only another package exports, or a single lowercase word a sibling entry exports, is offered in the message and never applied. Site links are absolute `https://www.hyperfrontend.dev/...` URLs, the form that works on GitHub, npm and the site alike. A link around inline code is validated wherever it points: site pages, `#api-` anchors, heading anchors, repository `blob` and `tree` URLs and relative paths.

---

## Banner

Never authored in the README. The build replaces the H1 with the recorded `banner.gif` under `assets/media/banner-testing/`; `lib-readme-media-regions` reports a README whose banner has not been recorded.

```bash
# fast check that the tagline fits two lines
npx hf run tool-media:preview --scene=banner-testing --at=0 --out=/tmp/banner.png

# record all three variants (writes the GIFs and banner.json together)
npx hf run tool-media:media --scene=banner-testing
```

Never interrupt a recording: a killed run can leave new GIFs beside a stale `banner.json`. Restore with `git checkout -- assets/media/banner-testing/` and record again.

---

## Sub-Module README

The floor:

```markdown
# moduleName

One-sentence statement of what this module does and why it exists.
```

The H1 matches the module folder name. The docs page renders this README plus an auto-generated scoped API reference, so a manual API table only duplicates it.

| Optional section   | When to add                                     |
| ------------------ | ----------------------------------------------- |
| `## Overview`      | Multi-step pipelines, mermaid diagrams          |
| `## Usage`         | Composition examples beyond a single signature  |
| `## Configuration` | User-facing config knobs that need explanation  |
| Semantic tables    | Taxonomies, decision rules, behaviour contracts |
| `## Design`        | Trade-offs, invariants, "why this and not that" |

Never: an `## API` export table, interface code blocks duplicating extractable types, or install commands.

---

## Validation

```bash
npx hf run lib-testing:lint          # a package: structure, links, examples, paragraphs
npx hf run hyperfrontend:lint        # the root README
npx hf run docs-site:lint            # after adding a markdown file or an entry point to a published library
npx hf run lib-testing:lint --fix    # applies every fixable rule to every file of the project, code included
```

`--fix` writes own-package API links, the description mirror and the compatibility tables, and whatever else in the project is fixable. Run it on a clean tree and read its diff.
