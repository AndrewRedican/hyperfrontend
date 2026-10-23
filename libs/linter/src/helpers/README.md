# helpers

What a rule asks of a file beyond the tree it is handed: the tokens and comments around a node, scopes and variables, the properties of a JSON document, line and column positions, globs, a fix merged from several edits, and the parse of another file. The packaged rules use the same functions.

## Usage

```typescript
import { defineRule } from '@hyperfrontend/linter'
import { findVariable, scopeAnalysisOf, scopeOf } from '@hyperfrontend/linter/helpers'

export default defineRule({
  id: 'local/no-shadowed-name',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Identifier(node) {
      if (node.name !== 'name') return
      const scope = scopeOf(scopeAnalysisOf(context), node)
      if (findVariable(scope, 'name') === null) return
      const message = 'Rename the local "name".'
      context.report({ start: node.start, end: node.end, message })
    },
  }),
})
```

## What is here

| Area      | Functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens    | [`tokenBefore`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-tokenBefore), [`tokenAfter`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-tokenAfter), [`tokensBetween`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-tokensBetween), [`tokenText`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-tokenText), [`commentsBetween`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-commentsBetween), [`isParenthesised`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-isParenthesised) |
| Tree      | [`childrenOf`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-childrenOf), [`parseCode`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-parseCode)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Scopes    | [`scopeAnalysisOf`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-scopeAnalysisOf), [`scopeOf`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-scopeOf), [`findVariable`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-findVariable), [`referenceOf`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-referenceOf), [`isGlobalReference`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-isGlobalReference)                                                                                                |
| JSON      | [`rootObject`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-rootObject), [`propertyOf`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-propertyOf), [`isString`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-isString), [`stringsUnder`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-stringsUnder), [`wholeDocument`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-wholeDocument), [`indentationAt`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-indentationAt)               |
| Positions | [`positionAt`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-positionAt), [`lineText`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-lineText)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Globs     | [`compileGlob`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-compileGlob), [`matchesAny`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-matchesAny)                                                                                                                                                                                                                                                                                                                                                                                                             |
| Fixes     | [`mergeEdits`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-mergeEdits)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Scope analysis is computed once per file and shared by every rule that asks for it, so calling [`scopeAnalysisOf`](https://www.hyperfrontend.dev/docs/libraries/linter/helpers/#api-scopeAnalysisOf) from several listeners costs one analysis.
