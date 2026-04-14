---
name: eslint-coverage
version: 1.0.0
description: Achieve 100% code coverage for custom ESLint rules by analyzing implementation code paths and adding/updating unit tests. Use when reviewing ESLint rules for coverage gaps, adding missing tests, or applying istanbul ignore comments for unreachable code.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# ESLint Rule Coverage Analysis

> **DO NOT RUN COMMANDS.** Never execute test coverage commands, Jest, or any terminal commands. This skill relies entirely on reading source files. Analyze code paths by inspection only.

Read implementation and tests in full. Map every branch to a test case. Add tests or istanbul ignores for gaps.

## Reference Locations

| What           | Where                             |
| -------------- | --------------------------------- |
| Rules          | `tools/eslint-rules/src/rules/`   |
| Test utilities | `tools/eslint-rules/src/testing/` |
| Shared utils   | `tools/eslint-rules/src/utils/`   |

**Before analyzing:** Read the full implementation file and full test file. Do not skim.

---

## Workflow

**All analysis is done by reading files — no commands.**

1. Read implementation — note every `if`, `?:`, `&&`, `||`, loop, map operation
2. Read test file — list what each case exercises
3. Map coverage — table of code path → test case (or gap)
4. Add tests — for reachable untested paths
5. Add ignores — for defensive/unreachable code

---

## Istanbul Ignore Format

```typescript
/* istanbul ignore if -- defensive check; source is always string literal in valid AST */
if (!source || typeof source.value !== 'string') {
  return null
}
```

```typescript
/* istanbul ignore else -- getSourcePath only returns null for malformed ASTs */
if (path) {
  recordPath(importPaths, path, node, node.importKind === 'type')
}
```

**Format:** `/* istanbul ignore {if|else|next} -- {reason} */`

---

## Test Naming

- ✓ `single import from a path`
- ✓ `flags missing field`
- ✗ `should report error when...`

---

## Checklist

- [ ] Read full implementation file
- [ ] Read full test file
- [ ] Map each code path to test case
- [ ] Add tests for untested reachable code
- [ ] Add istanbul ignore with reason for unreachable code
- [ ] All messageIds appear in invalid test cases
- [ ] Test names use assertive language (no "should")
