# README Docs: Structure Reference

The mechanics a library or sub-module README must satisfy. The lint rules below enforce most of it; read `SKILL.md` first for what the README is for.

---

## Reference Locations

| Item                  | Path / rule                                                 |
| --------------------- | ----------------------------------------------------------- |
| Library README        | `libs/<name>/README.md`                                     |
| Sub-module README     | `libs/<name>/src/<module>/README.md`                        |
| Banner tagline        | `TAGLINES` in `tools/media/scenes/package-banners.scene.ts` |
| Library structure     | `lib-readme-structure`                                      |
| Paragraph length      | `readme-paragraph-length` (700 rendered chars)              |
| Inline code links     | `lib-inline-code-links`                                     |
| Description mirror    | `lib-pkg-description`                                       |
| Runtime table         | `lib-readme-compatibility-table`                            |
| Media regions, banner | `lib-readme-media-regions`                                  |
| Sub-module README     | `lib-pkg-secondary-entry-readme`                            |
| Sub-module docs page  | `docs-site-secondary-entries`                               |

---

## Library README Layout

In order:

1. `# @hyperfrontend/<name>` (the build replaces it with the banner GIF in the dist README)
2. Badges block: two `<p align="center">` paragraphs of shields, copied from a sibling README
3. Optional hero: a centred `<a><img width="640" height="360" ...></a>` linking to the docs page
4. The description line (one sentence, see `SKILL.md`)
5. The two links:

```markdown
• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/<name>/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2F<name>)
```

6. Required `##` sections, in this order (others may sit between them):
   - `## What is @hyperfrontend/<name>?` with `### Key Features` (required) and `### Architecture Highlights` (optional)
   - `## Why Use @hyperfrontend/<name>?`
   - `## Installation`
   - `## Quick Start`
   - `## API Overview`
   - `## Compatibility`
7. `## Part of hyperfrontend` (carried by most siblings; keep it)
8. `## License`

`## Limitations` (optional) sits between API Overview and Compatibility.

### Badges

`lib-readme-structure` requires ten, matched by URL: build (`/github/actions/workflow/status`), coverage (`codecov.io`), npm version (`/npm/v/`), bundle size (`bundlephobia.com`), contributors (`/all-contributors`, inside the `ALL-CONTRIBUTORS-BADGE` markers), license (`/license-MIT`), downloads (`/npm/dm/`), stars (`/github/stars`), node version (`node-%3E%3D`), tree shakeable (`tree%20shakeable`). Copy the block from a sibling and change the package name, workflow file and coverage flag.

### Description line

The first paragraph after the badges block that does not start with `<`. `lib-pkg-description` mirrors it into `package.json` `description`; write it in the README and let `--fix` copy it. The banner reads its tagline from `TAGLINES`, falling back to the manifest description, so add a `TAGLINES` entry when a package's banner wraps past two lines.

### Key Features

A flat list of 3 to 12 bullets, each `- **Label** - explanation` or `- **[Label](url)** - explanation`. Label 48 characters or fewer, explanation at least 20. The docs site renders a correct list as a marked run and falls back to plain bullets otherwise.

### Architecture Highlights

Optional to the rule, but keep it when siblings of similar scope carry it. The docs site renders it as a margin note at the end of the page.

### Compatibility

The runtime table is wrapped in an `hf:media` region and generated from `metadata.compatibility` in `project.json`:

```markdown
<!-- hf:media start id="runtimes" scene="runtimes-<name>" asset="runtimes" docs="#compatibility" alt="..." -->

| Environment | Supported |
| ----------- | :-------: |
| ...         |    ...    |

<!-- hf:media end -->
```

`lib-readme-compatibility-table` fixes drift; the build swaps the region for the recorded runtime strip in the dist README only. `### Output Formats` and `### Peer Dependencies` tables follow when they apply.

### Inline code

Every inline code identifier, dotted member, `@hyperfrontend/*` name or `/subpath` must link to a validated docs target (`lib-inline-code-links`). Values, flags, file names, command lines and platform globals are exempt. Absolute `https://www.hyperfrontend.dev/...` URLs are the only form that works on GitHub, npm and the docs site alike. API anchors are `#api-<Symbol>` and `#api-<Type>-prop-<member>`.

---

## Banner

Never authored in the README. The build replaces the H1 with `assets/media/banner-<name>/banner.gif`; `lib-readme-media-regions` reports a README whose banner has not been recorded.

```bash
# fast check that the tagline fits two lines
npm run hf -- run tool-media:preview --scene=banner-<name> --at=0 \
  --out=<scratch>/banner.png

# record all three variants (writes the GIFs and banner.json together)
npm run hf -- run tool-media:media --scene=banner-<name>
```

Never interrupt a recording: a killed run can leave new GIFs beside a stale `banner.json`. Restore with `git checkout -- assets/media/banner-<name>/` and record again.

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
npm run hf -- run @hyperfrontend/workspace:lint:all
```
