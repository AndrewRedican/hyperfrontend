---
name: lint-coverage
description: Achieve 100% code coverage for lint rules and the linter in tools/lint. Use when reviewing lint rules for coverage gaps, adding missing spec cases, or applying node:coverage ignore comments.
---

# Lint Rule Coverage

**Be pedantic.** Every `if`, `else`, `?:`, `&&`, `||`, `??`, `?.`, early return, loop and callback: trace each branch. Miss nothing. Use `/* node:coverage ignore next */` comments only where a branch cannot be reached.

| What          | Where                                                     |
| ------------- | --------------------------------------------------------- |
| Rules         | `tools/lint/src/rules/<family>/`                          |
| Spec helper   | `tools/lint/src/testing/rule-tester.ts`                   |
| Coverage gate | `tools/lint/test.config.ts` (100 / 100 / 100 over `src/`) |

Run `npx nx test tool-lint`; the report lists every file under the threshold, with the uncovered lines, and fails on a file no spec loads. For one spec, run it alone from `tools/lint` with `--experimental-test-coverage --test-coverage-include=<file>` and an lcov reporter, and read the `BRDA:…,0` and `DA:…,0` lines.

---

## Ignore comments

Coverage is Node's own (V8), so the markers are Node's: `/* node:coverage ignore next */` skips the next line and `/* node:coverage ignore next N */` the next N lines; `/* node:coverage disable */` and `/* node:coverage enable */` bracket a region. istanbul and c8 markers do nothing. Put a `// why:` comment on the line above every marker, saying why the branch cannot be reached:

```typescript
// why: a JSX opening element holds only attributes and spread attributes.
/* node:coverage ignore next 3 */
if (attribute.kind !== 'JSXAttribute') {
  return false
}
```

Prefer removing an unreachable branch to ignoring it: a `?? fallback` that can never apply, or a guard the types already rule out, is dead code (`as` with a `// why:` line instead).

A module that holds only types has nothing a spec can load; list it in `coverageExclude` in `tools/lint/test.config.ts` beside the other type-only modules.

---

## Checklist

- [ ] Every branch → a spec case or a `node:coverage` ignore with a `why:` line
- [ ] Every message the rule can report appears in an invalid case
- [ ] Every fix shape appears with its `output`
- [ ] Test names: assertive (`reports X`), not speculative (`should report X`)
