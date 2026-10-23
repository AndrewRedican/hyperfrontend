# How to lint a project with @hyperfrontend/linter

You will lint a TypeScript or JavaScript project from its own configuration file, fix what the rules can fix, silence a finding where it is deliberate, and fail CI on a problem. [`@hyperfrontend/linter`](/docs/libraries/linter) does it with one development dependency and nothing beneath it: its parsers are its own, so the install brings no parser, plugin or transitive package with it.

The steps below use a small TypeScript project with a `src/` directory; the commands and the configuration hold for any layout.

## 1. Install the package

```bash
npm install --save-dev @hyperfrontend/linter
```

The command is `hf-lint`. Node.js 24 or later loads the configuration, which is a TypeScript module, without a compiler; the project's `package.json` should declare `"type": "module"` so that Node reads `lint.config.ts` as an ES module.

## 2. Create the configuration

Create `lint.config.ts` beside `package.json`. Its default export is a list of blocks. A block selects files with [`files`](/docs/libraries/linter#api-ConfigBlock-prop-files) and [`ignores`](/docs/libraries/linter#api-ConfigBlock-prop-ignores), globs relative to the configuration file's directory, and sets [`rules`](/docs/libraries/linter#api-ConfigBlock-prop-rules); for each file, a later block's setting wins over an earlier one.

```typescript
import { BROWSER_AND_NODE_GLOBALS, CODE, CODE_RULES, JAVASCRIPT, JSDOC_RULES, on } from '@hyperfrontend/linter'

export default [
  { ignores: ['dist/', 'coverage/', '**/node_modules/'] },
  { files: CODE, rules: CODE_RULES },
  { files: JAVASCRIPT, language: { globals: BROWSER_AND_NODE_GLOBALS } },
  { files: ['src/**/*.ts'], rules: JSDOC_RULES },
  { files: ['src/**/*.ts'], rules: on('no-enum import-order no-todo-comments') },
]
```

A block with only `ignores` ignores those paths everywhere. [`CODE_RULES`](/docs/libraries/linter#api-CODE_RULES), [`JSDOC_RULES`](/docs/libraries/linter#api-JSDOC_RULES) and [`REACT_RULES`](/docs/libraries/linter#api-REACT_RULES) hold the rules the upstream recommended configurations turn on; [`CODE`](/docs/libraries/linter#api-CODE) and [`JAVASCRIPT`](/docs/libraries/linter#api-JAVASCRIPT) are the matching file globs, and [`BROWSER_AND_NODE_GLOBALS`](/docs/libraries/linter#api-BROWSER_AND_NODE_GLOBALS) the names a script may read without declaring them. The full shape of a block is [`ConfigBlock`](/docs/libraries/linter#api-ConfigBlock).

## 3. Choose rules and set their options

Name a rule by its id, with `'error'`, `'warn'` or `'off'`, or with a severity and its options:

```typescript
import { CODE, CODE_RULES } from '@hyperfrontend/linter'

export default [
  { files: CODE, rules: CODE_RULES },
  {
    files: ['src/**/*.ts'],
    rules: {
      'max-file-lines': ['error', { maxLines: 400 }],
      'import-order': ['error', { internalScopes: ['@acme'] }],
      'typescript/no-explicit-any': 'off',
    },
  },
]
```

The [rule catalogue](/docs/libraries/linter/rules) lists every id with its options, defaults, examples and the preset that turns it on. An id the linter does not know is an error, so a typo never passes silently. React rules read their target version from a block's [`settings`](/docs/libraries/linter#api-ConfigBlock-prop-settings): `settings: { react: { version: '18.2' } }`.

## 4. Run it

```bash
npx hf-lint
npx hf-lint src/app.ts src/routes
npx hf-lint --format json > lint-report.json
```

With no paths, the command lints the working directory. It reads the nearest `lint.config.ts` at or above the working directory; `--config <path>` names another, and that file's globs are then relative to the working directory. The exit code is 0 when nothing is reported, 1 when an error is (or warnings exceed `--max-warnings`), and 2 when the command could not run or a file could not be linted. `npx hf-lint --help` lists every flag.

## 5. Apply fixes

```bash
npx hf-lint --fix-dry-run --format json
npx hf-lint --fix
```

`--fix` rewrites the files and reports what is left. `--fix-dry-run` changes nothing and puts each file's fixed text in the JSON report's `output`. Some rules offer suggestions instead of a fix where the change needs judgement; they appear under each message's `suggestions` in the JSON report and are never applied by `--fix`.

## 6. Silence a finding where it is deliberate

```typescript
// lint-disable-next-line typescript/no-non-null-assertion -- filled two lines above
const user = users.get(id)!

/* lint-disable typescript/no-explicit-any -- generated declarations */
export type Payload = any
/* lint-enable typescript/no-explicit-any */
```

`lint-disable-line` covers its own line; `lint-disable` and `lint-enable` work only as block comments. Write the reason after `--`. A directive that suppresses nothing is reported as a warning with a fix that removes it, so stale directives do not accumulate. To switch a rule off for whole files, prefer a configuration block with `files` over a directive in each file.

## 7. Fail CI on a problem

Add a script to `package.json`:

```json
{
  "scripts": {
    "lint": "hf-lint --max-warnings 0"
  }
}
```

Run `npm run lint` in CI.

## 8. Lint from code

[`lint`](/docs/libraries/linter#api-lint) runs the same steps as the command and returns the results instead of printing them; [`formatStylish`](/docs/libraries/linter#api-formatStylish) and [`formatJson`](/docs/libraries/linter#api-formatJson) print them.

```typescript
import { formatStylish, lint } from '@hyperfrontend/linter'

const report = await lint({ cwd: process.cwd(), patterns: ['src'], fix: false })
process.stdout.write(formatStylish(report.results))
process.exitCode = report.errorCount > 0 ? 1 : 0
```

## Check it worked

Add a `debugger` statement to a source file and run `npx hf-lint`: it reports `no-debugger` and exits with 1. Remove the statement and run it again: it prints nothing and exits with 0.
