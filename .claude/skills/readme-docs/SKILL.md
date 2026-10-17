---
name: readme-docs
description: Write and review README.md files for hyperfrontend libraries and sub-modules. Use when creating or editing a package README, writing its one-line description or banner tagline, cutting filler from a README, reviewing README quality, or checking README structure and lint compliance.
---

# README Docs

A package README says **what this is and why you would want it**, gets the reader running, then links to the docs.

Structure, badges, lint rules, banner commands: [REFERENCE.md](REFERENCE.md).

| Role           | Path                                                        |
| -------------- | ----------------------------------------------------------- |
| Library README | `libs/<name>/README.md`                                     |
| Precedent      | `libs/*/README.md` (siblings)                               |
| Banner tagline | `TAGLINES` in `tools/media/scenes/package-banners.scene.ts` |

**Before editing: read two sibling READMEs. Keep every section they carry.** Cut filler sentences, never established sections.

---

## Description Line

One idea: what the package is and why it is worth having. No feature list. **Two banner lines at most**: preview the banner; a third line means rewrite, never shrink the type. Offer the user 3 to 4 candidates with different angles before committing.

| ✗ Lists features, wraps to 3 lines                                                                                                            | ✓                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Jest-style describe, it, expect and jest on Node's built-in test runner, with module mocks, fake timers, an optional DOM and a coverage gate. | A lightweight Jest-like testing library built on native Node capabilities. |

---

## Section Budgets

| Section                 | Budget                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- |
| What is                 | Two short paragraphs: what it is; what it is not or who it is for.            |
| Key Features            | 5 to 7 bullets, one clause each, what the reader gains.                       |
| Architecture Highlights | Consumer-relevant guarantees only, then a link to the architecture page.      |
| Why Use                 | 2 to 4 reasons, one short paragraph each.                                     |
| Installation            | The command, plus an optional peer if any.                                    |
| Quick Start             | One working example, one command to run it. Fuller setups: a link to a guide. |
| API Overview            | Entry-point table and a link to the API reference.                            |
| Limitations (optional)  | 2 to 4 bullets that would change an adoption decision, then a link.           |
| Compatibility           | One sentence plus the generated tables.                                       |
| Part of hyperfrontend   | Sibling form: monorepo line, docs link, related-package bullets only.         |

---

## Filler: Cut on Sight

- **Timeless only.** No test counts, adoption stats, "used in production by", dates or proof that it works.
- **Lead-ins that restate what follows.** "The root entry is everything a spec imports: `describe`, `it`…" above a table or example that already shows it.
- **Saying it twice.** A caveat or rationale appears in one section.
- **Explaining how.** Name the capability; link the page that explains it.
- **Internals and version archaeology.** Mechanisms, which Node minor added which primitive.
- **Inventories.** Every modifier, option, member or matcher count listed inline.
- **Padding clauses.** "...so you are not left to discover it one failing test at a time."
- **Code names in prose.** Each needs a link (REFERENCE.md); say "mock functions", not `jest.fn`, unless the reader will type it.

Test each sentence: delete it. Reader loses something they need now? Keep it.

---

## Voice

- Address the reader's decision, not the author's achievement.
- No em dashes: use a colon, semicolon, parentheses or a full stop.
- No marketing adjectives. State the property.

---

## Checklist

- [ ] Every section the siblings carry is present
- [ ] Description: one idea, no list, ≤2 banner lines (previewed)
- [ ] `TAGLINES` entry when the manifest description wraps the banner
- [ ] Each section within budget; no filler from the list above
- [ ] Quick Start verified against the published package
- [ ] No em dashes (`grep —`)
- [ ] `npx nx lint:all` passes
