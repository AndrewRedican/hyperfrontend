---
name: readme-docs
description: Write, review, audit and revise README.md files in hyperfrontend, for a published package, a sub-module or any other project. Use when creating or editing a README, including one touched in passing during other work, when judging whether a README is good enough, cutting or relocating detail, linking API names, writing a description line or banner tagline, or checking README structure and lint compliance.
---

# README Docs

A README says **what this is, why you would want it and how to start**, then links to the rest. The goal is placement, not brevity: every fact has a home, and for most facts it is not the README.

Enforced rules, layout, section jobs, API link forms, banner commands: [REFERENCE.md](REFERENCE.md).

| Role              | Path                                                               |
| ----------------- | ------------------------------------------------------------------ |
| Package README    | `libs/**/README.md` beside a publishable `project.json`            |
| Calibration cases | `libs/testing/README.md`, `libs/linter/README.md`                  |
| Enforced rules    | `lint.base.config.ts`, `tools/lint/config/documentation-scopes.ts` |
| Rule documents    | `tools/lint/docs/rules/*.md`, `libs/linter/docs/rules/*.md`        |
| Banner tagline    | `TAGLINES` in `tools/media/scenes/package-banners.scene.ts`        |

---

## Gate

1. Lint the project without `--fix` and read two siblings before changing anything.
2. **A README that passes lint, the tracking check and the placement test is finished. Leave it.**
3. Remove no heading the README already has; add only what lint requires, and `## Part of hyperfrontend`, which every package README carries.
4. Make the smallest edit that fixes the finding. Rewrite a section only when its order is the fault.

---

## Placement

Sort each fact, then act on the verdict.

| Verdict  | The fact is                                                                                                 | Action                                 |
| -------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Keep     | Needed to choose the package, install it, run the first example, or avoid harm                              | State it once, where the need arises   |
| Relocate | True and useful after adoption: mechanisms, option inventories, further examples, edge cases, tuning        | Move it to its home and leave one link |
| Omit     | History, decisions, plans, workarounds, proof that it works, anything that exists only in an untracked file | Delete it                              |

**Never cut for brevity:** what a security feature does and does not claim, the runtime floor, a usage constraint or compatibility caveat (a minimum key length, an entry that needs a newer runtime), a "most projects want X instead" redirection, a limitation that would change the decision to adopt.

**Never claim more than the code does.** Read the source behind a guarantee, above all a security one, before keeping or writing it.

| Relocated material                              | Home                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| How it works, trade-offs, formats, threat model | `ARCHITECTURE.md` beside the README (`architecture-docs` skill)  |
| One entry point's behaviour                     | `src/<module>/README.md`, rendered as that entry's page          |
| Task walkthroughs, fuller setups                | A guide under `apps/docs-site/content/guides/` (`how-to-guides`) |
| Signatures, options, every member               | JSDoc, which generates the API reference (`jsdoc-examples`)      |

Check the home already says it before moving text; usually it does and the README copy is just deleted. Where the home exists but lacks it, move the text there. A package with no `ARCHITECTURE.md` keeps its contracts in API Overview: that is their home, not a restatement. Create a document only when no home exists and the material is worth keeping: a new markdown file in a published library also needs a docs page (`docs-site-library-docs`).

---

## API Names

Inline code is a **name** (a package, a `/subpath`, an export, a member, a bundle global) or a **value** (a literal, flag, file, path, command, platform global, or any call or expression such as `has()`). In every markdown file of a published library except `CHANGELOG.md`, `lib-inline-code-links` requires each name to link and validates the destination. Values, headings and fenced code are left alone.

- **Lint decides what is a name.** Link what it reports; do not link what it passes.
- **Let the fixer write the link.** It links whatever the package's own entry points export. Never compose an `#api-` anchor from memory.
- **Then read each linked bare word.** A word that is a value in its sentence (a branch called `main`, a state called `success`) links to an unrelated export: write it as prose.
- Where lint offers candidates from elsewhere, link the one the sentence means. Where it offers none, link the page that explains the word or write it as prose.
- **Fewer links means fewer names in prose, never unlinked names.** Say "mock functions", not `jest.fn`, unless the reader will type it.
- Outside a published library nothing enforces linking: link where a reader would look something up, and do not retrofit.

---

## Filler

- **Lead-ins that restate** the table or example below them.
- **Saying it twice.** A claim or rationale lives in one section. A never-cut caveat may repeat where a reader could otherwise miss it.
- **Padding clauses** and marketing adjectives. State the property.
- **Em dashes**, and spaced hyphens standing in for them. Use a colon, semicolon, parentheses or a full stop.

Test a sentence by deleting it. If the reader loses something needed now, restore it.

---

## Hygiene

**A tracked document never names a file the repository does not hold**: no link, path or allusion. Lint only checks that a link's target exists on disk, so check tracking yourself for every path a README names. Files the package ships (`index.mjs` in an output table) are not references.

```bash
git ls-files --error-unmatch libs/testing/ARCHITECTURE.md || git check-ignore -v libs/testing/ARCHITECTURE.md
```

| Result                         | Meaning                               | Action                    |
| ------------------------------ | ------------------------------------- | ------------------------- |
| First command succeeds         | Tracked                               | Fine                      |
| Second prints a rule           | Ignored: it exists only in this clone | Remove the reference      |
| Both fail, the file exists     | New                                   | Commit it with the README |
| Both fail, the file is missing | Broken link                           | Fix or remove             |

---

## Audit

Evidence, strongest first:

1. Lint output for the project.
2. Tracking status of every path the README names.
3. Examples and claims against the source: an example that does not parse or typecheck, a link to the wrong symbol, a guarantee the code does not keep.
4. The rule's document and the two configuration files: what is enforced, and why.
5. The source of derived content: `TAGLINES`, the manifest description, `metadata.compatibility`, recorded media.
6. Sibling READMEs that already pass 1 to 5 and the placement test.
7. The placement test.

1 to 5 are facts: report them as violations. 6 and 7 are judgment: report them as editorial findings, apart from the violations. Classify every README before editing any.

| Class          | Meaning                                                               | Action           |
| -------------- | --------------------------------------------------------------------- | ---------------- |
| Gold           | No violations, every fact in its place                                | Preserve         |
| Adequate       | Sound, with sentences misplaced, repeated or inaccurate               | Minimal edits    |
| Needs revision | A violation, or the reader wades through mechanism to reach the start | Focused revision |

No quota per class, and length decides nothing.

---

## Checklist

- [ ] Linted without `--fix` before, and clean after
- [ ] No established section removed; none invented
- [ ] Each fact kept, relocated with one link, or omitted; nothing from the never-cut list lost
- [ ] No name lint reports; links written by the fixer and read afterwards
- [ ] Examples parse and typecheck; no claim exceeds the code
- [ ] `TAGLINES` entry updated when the description's idea changed
- [ ] Every path the README names is tracked
- [ ] Diff holds only justified changes
