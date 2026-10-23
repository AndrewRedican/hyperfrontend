---
name: de-eslint
description: Retire ESLint from a JS/TS codebase without losing a check. Inventory the effective configuration and the behaviour it enforces, bound what must survive, keep ESLint as the executable oracle while the replacement is built and compared on deliberate violations, then remove ESLint, its parser and plugins. Use when removing ESLint, replacing typescript-eslint or ESLint plugins, adopting @hyperfrontend/linter, porting custom ESLint rules, or debugging a lint migration (rules silently not running, diagnostics or fixes that drifted, directives that stopped suppressing).
---

# De-ESLint: retire ESLint without losing a check

The cost is the behaviour the configuration enforces, not the package count. Measure it, keep ESLint runnable until parity is proven, never take a quiet run as proof.

Context: [I Replaced ESLint. The First Attempt Worked. I Threw It Away.](https://www.hyperfrontend.dev/articles/i-replaced-eslint-the-first-attempt-worked-i-threw-it-away/) Adoption path for `@hyperfrontend/linter`: [Replace ESLint with @hyperfrontend/linter](https://www.hyperfrontend.dev/docs/guides/replace-eslint-with-hyperfrontend-linter/).

## Paths

| Role                      | Where                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| ESLint configuration      | `eslint.config.*`, `.eslintrc*`, `.eslintignore`, `overrides` in `package.json`                |
| Replacement configuration | `lint.config.ts` (nearest wins; `--config` names another)                                      |
| Custom rules              | wherever `plugins` resolve inside the repo; their `RuleTester` suites are the spec             |
| Oracle                    | an ignored scratch directory: printed configs, baseline reports, corpus, comparison            |
| Integrations              | `package.json` scripts, hooks, CI steps, task-runner targets and cache inputs, editor settings |

## Gate

- **A warning-free run is not evidence.** A replacement that stopped running a rule produces exactly that. Parity rests on deliberate violations that must still be reported.
- **Census before strategy.** No approach until the inventory exists.
- **ESLint stays installed until the comparison passes.**
- **Every difference is fixed or recorded with its reason.** An unexplained one blocks removal.
- **Bound the job.** Reimplement the behaviour the configuration enables, not the upstream rule's option surface or ESLint's engine.

## 1. Inventory

```bash
mkdir -p .de-eslint
for file in src/index.ts src/App.tsx src/index.spec.ts package.json README.md; do
  npx eslint --print-config "$file" > ".de-eslint/config-$(basename "$file").json"
done
npx eslint --format json . > .de-eslint/baseline.json
npx eslint --fix-dry-run --format json . > .de-eslint/baseline-fixes.json
grep -rnE 'eslint-(disable|enable)|/\* *(global|eslint) ' src > .de-eslint/directives.txt
```

One `--print-config` per kind of file the configuration treats differently. From them, record:

| Record                 | From                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Effective rules        | the non-`off` rules per kind, with severity and options; union them                                             |
| File coverage          | `files`/`ignores` per block; which paths are linted at all, which are ignored on purpose                        |
| Parser needs           | `languageOptions.parser`, `parserOptions.project`, JSX, decorators, `sourceType`, `globals`, `settings`         |
| Custom and local rules | `plugins` resolving inside the repo                                                                             |
| Integrations           | every script, hook, CI step, `--cache` flag, formatter, editor setting and task-runner target that names ESLint |
| Directives             | `directives.txt`, with the rule ids each names                                                                  |

## 2. Bound

Sort every enabled rule: **covered** (the replacement implements it and the options in use), **adapt** (needs a custom rule or an option the replacement lacks), **unsupported** (type-aware, a plugin with no counterpart, editor-only value). Decide each unsupported rule with the owner: accept the gap, write the rule, or keep ESLint. **Never map a rule to a differently named one because it looks similar.**

## 3. Keep an executable oracle

- Corpus: for every covered or adapted rule, one snippet it must report, one it must accept, and for a fixing rule the expected fixed text. Take snippets from the upstream rule's own tests where the licence allows; keep attribution.
- Capture ESLint on the corpus and the tree (`--format json`, `--fix-dry-run --format json`). Regenerate captures only from ESLint itself.
- Compare by `(file, ruleId, line, column, message)`, mapping ids (`@typescript-eslint/x` to its new name). Compare fixed text byte for byte.
- **Plant a difference and watch the comparison catch it** before trusting a green comparison.

```ts
import { readFileSync } from 'node:fs'

type Report = { filePath: string; messages: { ruleId: string | null; line: number; column: number }[] }[]
const read = (file: string): Report => JSON.parse(readFileSync(file, 'utf8'))
const keys = (report: Report, rename: (id: string) => string): Set<string> =>
  new Set(report.flatMap((r) => r.messages.map((m) => `${r.filePath}:${m.line}:${m.column} ${rename(m.ruleId ?? '')}`)))

const before = keys(read('.de-eslint/baseline.json'), (id) => id.replace('@typescript-eslint/', 'typescript/'))
const after = keys(read('.de-eslint/after.json'), (id) => id)
console.log(
  'only ESLint:',
  [...before].filter((key) => !after.has(key))
)
console.log(
  'only replacement:',
  [...after].filter((key) => !before.has(key))
)
```

## 4. Replace in small verified steps

One layer at a time (configuration, then rule group, then directives, then integrations), each followed by the comparison. Commit only what compares clean or carries a recorded difference.

| Symptom                                              | Cause                                                                          | Fix                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Clean run, fewer findings than the baseline          | a rule id unknown to the replacement was ignored, or a block's `files` missed  | make unknown ids errors; diff the effective rule set per file kind against the inventory                |
| A check vanished with its integration                | rules that came from a plugin or framework preset were removed with its wiring | list every rule a preset contributed before deleting the preset; sort each as covered/adapt/unsupported |
| Directives stop suppressing, or suppress everything  | directive syntax or ids changed; a bare disable now covers new rules           | rename ids in directives; report unused directives; grep for directives naming unknown ids              |
| Same finding, different column                       | 0- vs 1-based columns, tab width, or reporting on a different node             | fix positions in the replacement; positions are behaviour                                               |
| Message text differs                                 | rewording during reimplementation                                              | keep upstream messages unless a difference is recorded; tools and people grep them                      |
| Fix output differs                                   | overlapping fixes applied in a different order, or a different pass limit      | apply non-overlapping fixes per pass, repeat to a fixed point with a cap; compare after every pass      |
| Custom rule passes its tests, reports nothing in use | registered under one id, configured under another, or reads the wrong language | lint one corpus file with that rule alone and require a report                                          |
| Parity on clean code, divergence on edge syntax      | the replacement parser lacks a construct                                       | add parse-verdict checks against the reference compiler for the syntax the codebase uses                |

## 5. Remove

Only after the comparison passes on the corpus and the tree:

- Swap scripts, hooks, CI and task-runner targets; point cache inputs at the replacement's sources and configuration.
- Uninstall ESLint, its parser, plugins, shareable configs and orphaned `overrides`; regenerate the lockfile; delete `eslint.config.*`, `.eslintrc*`, `.eslintignore`, editor settings.
- `grep -rn eslint .` outside `node_modules`: every remaining hit is a deliberate mention, a third-party optional peer, or a record.
- Keep the licence and attribution of any adapted rule code, messages or test cases.

## Report

Rules covered, adapted, dropped (with reasons); packages and lockfile size before and after; run time on the same machine, labelled an observation, not a benchmark; what was lost (editor feedback, type-aware rules, caching); who now owns the parser and rules. Coverage of the replacement says which code ran, not that it matches ESLint everywhere.

## Checklist

- [ ] Inventory per file kind, baseline reports and directive census saved
- [ ] Every enabled rule sorted covered / adapt / unsupported, decisions recorded
- [ ] Corpus with must-report, must-accept and fixed-text cases; a planted difference was caught
- [ ] Comparison clean or every difference recorded; unknown rule ids are errors
- [ ] Directives converted; unused directives reported
- [ ] ESLint and its plugins uninstalled only after the comparison; lockfile regenerated; `grep eslint` reviewed
- [ ] Attribution kept; results and losses reported without overstatement
