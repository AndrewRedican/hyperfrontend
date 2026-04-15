---
name: eslint-coverage
version: 2.0.0
description: Achieve 100% code coverage for custom ESLint rules. Use when reviewing ESLint rules for coverage gaps, adding missing tests, or applying istanbul ignore comments.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# ESLint Rule Coverage

> **NO TERMINAL COMMANDS.** Read source only.

**Be pedantic.** Every `if`, `else`, `?:`, `&&`, `||`, early return, loop, callback—trace each branch. Miss nothing. Use istanbul ignore comments where needed.

| What  | Where                             |
| ----- | --------------------------------- |
| Rules | `tools/eslint-rules/src/rules/`   |
| Utils | `tools/eslint-rules/src/testing/` |

---

## Checklist

- [ ] Every branch → test case or istanbul ignore
- [ ] All messageIds exercised
- [ ] Test names: assertive (`flags X`), not speculative (`should flag X`)
