# testing

Specifies a rule with cases: valid texts that must report nothing, and invalid texts with the messages, positions and fixed text they must produce. [`testRule`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/#api-testRule) declares one `node:test` test per case, so the specs run under `node --test` or any runner built on it.

## Usage

```typescript
import { testRule } from '@hyperfrontend/linter/testing'
import rule from './no-debugger'

testRule(rule, {
  valid: [{ name: 'a plain call', path: '/project/src/a.ts', text: 'run()\n' }],
  invalid: [
    {
      name: 'a debugger statement',
      path: '/project/src/a.ts',
      text: 'debugger\n',
      errors: [{ message: 'Remove the debugger.', line: 1, column: 1 }],
      output: null,
    },
  ],
})
```

Each case names the absolute `path` the text is linted as; the project root is the path's directory unless [`root`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/#api-RuleCase-prop-root) says otherwise. A case can pass [`options`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/#api-RuleCase-prop-options), [`settings`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/#api-RuleCase-prop-settings) and [`language`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/#api-RuleCase-prop-language) the way a configuration block would. On an invalid case, [`output`](https://www.hyperfrontend.dev/docs/libraries/linter/testing/#api-InvalidCase-prop-output) is the text after the rule's fixes; leave it out, or set it to `null`, when the rule must offer no fix.
