---
name: readme-docs
description: Write, review, audit and revise README.md files in hyperfrontend, for a published package, a sub-module or any other project. Use when creating or editing a README, including one touched in passing during other work, when judging whether a README is good enough, cutting or relocating detail, linking API names, writing a description line or banner tagline, or checking README structure and lint compliance.
---

# README Docs

A README says **what this is, why you would want it and how to start**, then links to the rest. The goal is placement, not brevity: every fact has a home, and for most facts it is not the README.

Write for an experienced developer who has never seen the package and is deciding whether it deserves five more minutes. They leave knowing five things: what it is, why it exists and when they would want it, what makes it worth considering, how to start, and where to learn more. Everything else must justify its presence. Optimise for the understanding gained per minute of reading, not for how much the README holds.

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
3. Remove no heading of the standard layout that the README already has; add only what lint requires, and `## Part of hyperfrontend`, which every package README carries. A heading that exists to hold relocatable material goes with the material.
4. Make the smallest edit that fixes the finding. Rewrite a section only when its order is the fault.
5. The exception to 4 is a README that has outgrown its job: it passes lint, and a first-time reader still wades through reference material to learn what the package is. Curate that one again from the reader's side, section by section, instead of trimming sentences. Do not keep a structure because it exists, and do not rewrite a section that already works.

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

A task walkthrough cut from a README goes to a guide, never to the architecture document. Look first for a guide that already covers the task (`apps/docs-site/content/guides/`, compiled to `apps/docs-site/public/docs/guides/`, and filtered by package on the page the README's guides link opens): extend it, or write one with the `how-to-guides` skill when the package has none for that task. Where writing it is outside the work in hand, tell whoever asked, naming the guide that is missing and what it would hold. A README whose guides link opens an empty list is such a gap.

---

## Proportion

- **A README does not grow with the package.** When a feature lands, place its facts (JSDoc, the entry's README, the architecture document, a guide) and touch the README only where the answer to what, why or how to start changed. A specification's list of what the documentation must state names facts to place, not README sections.
- **Lead with what is distinctive.** The purpose, the practical value and the capabilities a reader would not assume get the prominent treatment and come first.
- **Ordinary capability gets a clause.** What every package of its kind does is acknowledged in a feature bullet, not explained.
- **Order by distinctiveness.** Key Features and Limitations are ordered by what would change a reader's decision, not by layer or subsystem. A scan reads the first three bullets.
- **Why Use names the alternative.** Its lead says what the reader uses today, what this package does that the alternative leaves to them, what it leaves out in turn, and what it does not replace.
- **A headline claims no more than its body.** A bold label or a heading that the section's own text, or Limitations, then qualifies is an overclaim: narrow the headline.
- **The reader's word first.** A house term (step, contract, plan, spec) is tied at first use to the word the reader already knows, and keeps one meaning for the whole file.
- **Output comes with its command.** A Quick Start that shows what a program prints shows the command that printed it.
- **Broad strokes.** Say what a capability lets the reader do, not its mechanism, its edge cases or every permutation of its options. A README can be accurate without listing every exception; what may not be cut is the never-cut list above.
- **It survives a 30-second scan.** The headings, the first sentence under each, the Key Features labels and the first example carry the package on their own. A reader who gives it five minutes finds nothing they had to study.
- **Budget: 150 to 250 source lines** for a package README, badges and compatibility tables included; the calibration cases are under 200. A section that grows a tree of sub-headings of its own is a guide or an architecture section in the wrong file. Past the budget, run the placement test again before anything else.

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

| Class          | Meaning                                                                | Action           |
| -------------- | ---------------------------------------------------------------------- | ---------------- |
| Gold           | No violations, every fact in its place                                 | Preserve         |
| Adequate       | Sound, with sentences misplaced, repeated or inaccurate                | Minimal edits    |
| Needs revision | A violation, or the reader wades through mechanism to reach the start  | Focused revision |
| Outgrown       | Lint-clean, and it reads as a reference manual: it grew with a feature | Curate it again  |

No quota per class. Length is a reason to run the placement test, never a verdict by itself: a README inside the budget can still be misplaced, and one past it can be right for a protocol.

---

## Checklist

- [ ] Linted without `--fix` before, and clean after
- [ ] No section of the standard layout removed; none invented
- [ ] Each fact kept, relocated with one link, or omitted; nothing from the never-cut list lost
- [ ] The five questions are answered by a 30-second scan, the most valuable first
- [ ] Inside the length budget, or every section past it justified
- [ ] Nothing was added only because the implementation has it
- [ ] No name lint reports; links written by the fixer and read afterwards
- [ ] Examples parse and typecheck; no claim exceeds the code
- [ ] `TAGLINES` entry updated when the description's idea changed
- [ ] Every path the README names is tracked
- [ ] Diff holds only justified changes
