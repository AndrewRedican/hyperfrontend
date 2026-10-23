# How to write and test a custom lint rule

You will write a rule of your own for [`@hyperfrontend/linter`](/docs/libraries/linter), give it a fix, register it in the project's configuration, and pin its behaviour down with tests that run on Node's test runner. A rule is the place for a check the packaged rules do not make: a convention of your team, an API your code must not call, a pattern that broke production once.

The rule built here reports a focused test, `it.only`, `describe.only` or `test.only`, which silently skips every other test in the run, and its fix removes the `.only`.

## 1. Define the rule

Create `lint-rules/no-focused-tests.ts`:

```typescript
import { defineRule, type Node } from '@hyperfrontend/linter'

const BLOCKS = new Set(['describe', 'it', 'test'])

export default defineRule<undefined, Node>({
  id: 'local/no-focused-tests',
  language: 'code',
  fixable: true,
  create: (context) => ({
    MemberExpression(node) {
      const { object, property } = node
      if (node.computed || object?.kind !== 'Identifier') return
      if (property?.kind !== 'Identifier' || property.name !== 'only') return
      if (!BLOCKS.has(object.name as string)) return
      context.report({
        start: node.start,
        end: node.end,
        message: `Remove .only from ${object.name}: it skips every other test.`,
        fix: { start: object.end, end: node.end, text: '' },
      })
    },
  }),
})
```

[`defineRule`](/docs/libraries/linter#api-defineRule) types the module as a [`RuleModule`](/docs/libraries/linter#api-RuleModule). Its [`language`](/docs/libraries/linter#api-RuleModule-prop-language) says which files it reads: `code` for TypeScript and JavaScript, `json`, `markdown`, or `text` for YAML read as lines. [`create`](/docs/libraries/linter#api-RuleModule) runs once per file and returns [`Listeners`](/docs/libraries/linter#api-Listeners) keyed by node kind; the engine walks each file once and calls every rule's listener for each node, with `Kind:exit` for the way out. Code trees are ESTree-shaped [`Node`](/docs/libraries/linter#api-Node) values with `start` and `end` offsets.

## 2. Report a problem and its fix

[`context.report`](/docs/libraries/linter#api-RuleContext-prop-report) takes a [`Problem`](/docs/libraries/linter#api-Problem): offsets into the file's text, a message, and optionally a `fix`, one replacement `{ start, end, text }`. The engine turns offsets into lines and columns, applies `lint-disable` directives, and applies fixes under `--fix`. Set `fixable: true` on a rule that fixes. A change that needs the author's judgement belongs in `suggestions`, a list of `{ message, fix }`, which the JSON report carries and `--fix` never applies.

The [`RuleContext`](/docs/libraries/linter#api-RuleContext) also carries the file's text and comments, the rule's options and the blocks' settings; the [`/helpers`](/docs/libraries/linter/helpers) entry answers what a listener's node does not, such as neighbouring tokens, scopes and variables, and JSON properties.

## 3. Register it

A configuration block's [`families`](/docs/libraries/linter#api-ConfigBlock-prop-families) registers rules under a prefix; the rule's id is the prefix, a slash and its name:

```typescript
import { CODE, CODE_RULES } from '@hyperfrontend/linter'
import noFocusedTests from './lint-rules/no-focused-tests.ts'

export default [
  { families: { local: { 'no-focused-tests': noFocusedTests } } },
  { files: CODE, rules: CODE_RULES },
  { files: ['**/*.spec.ts'], rules: { 'local/no-focused-tests': 'error' } },
]
```

A family's entry may also be a function that imports the module, `() => import('./lint-rules/no-focused-tests.ts')`, so that the rule loads only when a block turns it on. The packaged prefixes (`typescript`, `jsdoc`, `react`, `react-hooks`, `package-json`) cannot be registered again. Relative imports keep their `.ts` extension, because Node loads the configuration and the rule as they are written.

## 4. Test it

Create `lint-rules/no-focused-tests.spec.ts`:

```typescript
import { testRule } from '@hyperfrontend/linter/testing'
import rule from './no-focused-tests.ts'

const message = (block: string): string => `Remove .only from ${block}: it skips every other test.`

testRule(rule, {
  valid: [
    {
      name: 'a plain test',
      path: '/project/a.spec.ts',
      text: "it('adds', () => {})\n",
    },
    {
      name: 'only on another object',
      path: '/project/a.spec.ts',
      text: 'list.only()\n',
    },
  ],
  invalid: [
    {
      name: 'a focused test',
      path: '/project/a.spec.ts',
      text: "it.only('adds', () => {})\n",
      errors: [{ message: message('it'), line: 1, column: 1 }],
      output: "it('adds', () => {})\n",
    },
  ],
})
```

[`testRule`](/docs/libraries/linter/testing#api-testRule) declares one `node:test` test per case. A valid case must report nothing; an invalid one must report exactly the listed messages, in position order, and, when `output` is given, produce that text after fixes, with `null` meaning the rule must offer no fix. A case can set `options`, `settings` and `language` the way a configuration block would. Run the tests:

```bash
node --test 'lint-rules/*.spec.ts'
```

## Check it worked

The tests pass. Add `describe.only('cart', () => {})` to a spec file and run `npx hf-lint`: it reports `local/no-focused-tests` on that line, and `npx hf-lint --fix` removes the `.only`.
