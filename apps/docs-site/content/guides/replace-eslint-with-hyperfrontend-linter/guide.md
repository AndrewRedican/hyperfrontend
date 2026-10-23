# How to replace ESLint with @hyperfrontend/linter

You will move a project's linting from ESLint to [`@hyperfrontend/linter`](/docs/libraries/linter), keep the checks the project relies on, prove that they still run, and remove ESLint, its parser and its plugins. The point is fewer packages in every install: the replacement has no dependencies of its own. How the hyperfrontend repository made the same move, including what it cost, is told in [I Replaced ESLint. The First Attempt Worked. I Threw It Away.](/articles/i-replaced-eslint-the-first-attempt-worked-i-threw-it-away)

## Before you begin

This is not a drop-in replacement for every ESLint configuration or plugin. Check that the project fits before you start:

- **Every rule it relies on is in the [rule catalogue](/docs/libraries/linter/rules), with the options it uses, or is one you will write.** The catalogue lists what is reimplemented from ESLint, typescript-eslint, eslint-plugin-jsdoc, eslint-plugin-react, eslint-plugin-react-hooks and eslint-plugin-package-json, and the options each rule reads; anything else becomes a [rule of your own](/docs/guides/write-and-test-a-custom-lint-rule) or is dropped on purpose.
- **No rule needs the type checker.** typescript-eslint's type-aware rules, the ones `parserOptions.project` enables, have no counterpart.
- **Lint runs from the terminal, a hook or CI.** The configuration names rules only: files are read by extension as TypeScript and JavaScript (JSX included), JSON and Markdown, with no plugins, parsers, processors, shareable configs or editor integration.

If the project depends on any of these, decide now whether to accept the gap or keep ESLint.

## 1. Record what ESLint enforces today

Print the effective configuration for one representative file of each kind, and keep a JSON report of a full run as the baseline:

```bash
npx eslint --print-config src/index.ts > eslint-ts.json
npx eslint --print-config src/view.tsx > eslint-tsx.json
npx eslint --format json . > eslint-baseline.json
```

From the printed configurations, list every rule that is not `off`, with its severity and options, and note the plugins, parser options, `globals`, `settings` and ignore patterns. Search the code for inline directives too: `grep -rn "eslint-disable\|eslint-enable\|/\* global" src`.

## 2. Map each rule

Look each rule up in the [rule catalogue](/docs/libraries/linter/rules). Ids carry over with one change of prefix:

| ESLint rule                 | @hyperfrontend/linter rule |
| --------------------------- | -------------------------- |
| `no-var` (core)             | `no-var`                   |
| `@typescript-eslint/<name>` | `typescript/<name>`        |
| `jsdoc/<name>`              | `jsdoc/<name>`             |
| `react/<name>`              | `react/<name>`             |
| `react-hooks/<name>`        | `react-hooks/<name>`       |
| `package-json/<name>`       | `package-json/<name>`      |

Compare the options you use with those the catalogue entry lists. Sort every rule into one of three lists: mapped as it is, needing a custom rule, or deliberately dropped. Do not substitute a different rule because its name is similar; an unmatched rule is a decision to record.

## 3. Write the configuration

Install the package and create `lint.config.ts`; the project's `package.json` must declare `"type": "module"`, so that Node reads the configuration as an ES module. ESLint's flat configuration translates block by block: [`files`](/docs/libraries/linter#api-ConfigBlock-prop-files), [`ignores`](/docs/libraries/linter#api-ConfigBlock-prop-ignores) and [`rules`](/docs/libraries/linter#api-ConfigBlock-prop-rules) keep their meaning, [`settings`](/docs/libraries/linter#api-ConfigBlock-prop-settings) passes through, and `languageOptions.globals` becomes [`language`](/docs/libraries/linter#api-ConfigBlock-prop-language)`.globals`. Drop `plugins`, `languageOptions.parser` and `parserOptions`.

```bash
npm install --save-dev @hyperfrontend/linter
```

```typescript
import { BROWSER_AND_NODE_GLOBALS, CODE, CODE_RULES, JAVASCRIPT, REACT_RULES } from '@hyperfrontend/linter'

export default [
  { ignores: ['dist/', 'coverage/'] },
  { files: CODE, rules: CODE_RULES },
  { files: JAVASCRIPT, language: { globals: BROWSER_AND_NODE_GLOBALS } },
  {
    files: ['src/**/*.tsx'],
    rules: REACT_RULES,
    settings: { react: { version: '18.3' } },
  },
  { files: ['src/**/*.ts'], rules: { 'typescript/no-explicit-any': 'error' } },
]
```

[`CODE_RULES`](/docs/libraries/linter#api-CODE_RULES) stands in for `eslint:recommended` with typescript-eslint's `recommended`; [`REACT_RULES`](/docs/libraries/linter#api-REACT_RULES) for the React and hooks recommended sets. [Lint a project with @hyperfrontend/linter](/docs/guides/lint-a-project-with-hyperfrontend-linter) covers the rest of the configuration.

## 4. Convert the directives

Rename every inline directive and rule id:

| ESLint                                                      | @hyperfrontend/linter                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `// eslint-disable-next-line no-var`                        | `// lint-disable-next-line no-var`                            |
| `// eslint-disable-line @typescript-eslint/no-explicit-any` | `// lint-disable-line typescript/no-explicit-any`             |
| `/* eslint-disable react/display-name */`                   | `/* lint-disable react/display-name */`                       |
| `/* eslint-enable */`                                       | `/* lint-enable */`                                           |
| `/* global analytics */`                                    | `language: { globals: { analytics: 'readonly' } }` in a block |

`lint-disable` and `lint-enable` must be block comments. A directive naming a rule the linter does not know is an error, and one that suppresses nothing is reported, so the first run lists every directive the conversion missed.

## 5. Port the custom rules

For each rule on the custom list, write a rule with [`defineRule`](/docs/libraries/linter#api-defineRule) and register it under a prefix of your own with `families`; [Write and test a custom lint rule](/docs/guides/write-and-test-a-custom-lint-rule) walks through one. The listener model is ESLint's, by node kind over an ESTree-shaped tree; a report takes offsets (`start`, `end`) where ESLint takes a node or a location, and a fix is a single `{ start, end, text }` replacement. Port each rule's ESLint test cases into [`testRule`](/docs/libraries/linter/testing#api-testRule) cases before porting its code.

## 6. Compare the two

Keep ESLint installed until this step passes. Run both on the same files and compare what each reports, by file, rule, line and column:

```bash
npx hf-lint --format json . > hf-lint-report.json
```

```typescript
import { readFileSync } from 'node:fs'

type Report = { filePath: string; messages: { ruleId: string | null; line: number; column: number }[] }[]
const read = (file: string): Report => JSON.parse(readFileSync(file, 'utf8'))
const keys = (report: Report, rename: (id: string) => string): Set<string> =>
  new Set(report.flatMap((r) => r.messages.map((m) => `${r.filePath}:${m.line}:${m.column} ${rename(m.ruleId ?? '')}`)))

const before = keys(read('eslint-baseline.json'), (id) => id.replace('@typescript-eslint/', 'typescript/'))
const after = keys(read('hf-lint-report.json'), (id) => id)
console.log(
  'only ESLint:',
  [...before].filter((key) => !after.has(key))
)
console.log(
  'only hf-lint:',
  [...after].filter((key) => !before.has(key))
)
```

Every line in either list is either a rule you dropped on purpose or a difference to investigate. A clean codebase compares nothing, so also lint files with deliberate violations: for each mapped rule, one snippet it must report. Compare fixes the same way, with `--fix-dry-run --format json` on both tools and the `output` of each file.

## 7. Switch the scripts and CI

Replace `eslint` in `package.json` scripts, hooks and CI steps with `hf-lint`, keeping `--max-warnings 0`, dropping `--cache`, and keeping `--format` only for `stylish` or `json`. Remove the ESLint extension's workspace settings; with no inline feedback in the editor, a pre-commit hook is where the team catches problems before CI does.

## 8. Remove ESLint

```bash
npm uninstall eslint @eslint/js typescript-eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsdoc eslint-plugin-package-json globals
```

Uninstall the packages your project actually lists. Then delete `eslint.config.*`, `.eslintrc*` and `.eslintignore`, and move any ignore pattern still in use into the first block of `lint.config.ts`.

## Check it worked

`npx hf-lint` exits with 0 on the project and with 1 on each deliberate violation from step 6, `npm ls eslint` finds nothing, and the comparison lists only the rules you chose to drop.
