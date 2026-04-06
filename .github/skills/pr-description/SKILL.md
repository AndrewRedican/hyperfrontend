---
name: pr-description
version: 1.0.0
description: Generate a PR description and write it to PR.md by comparing the current branch against main. Use when creating a pull request, writing PR descriptions, drafting PR copy, or generating PR.md. Reads commit messages first, then lightly inspects diffs only when further context improves accuracy.
allowed-tools:
  - Read
  - Write
  - Edit
  - Terminal
  - Grep
  - Glob
---

# PR Description Maker

Compare current branch against `main`, fill the PR template, generate a Title Case PR title, and write to `PR.md`.

---

## Reference Locations

| Item        | Path                               |
| ----------- | ---------------------------------- |
| PR Template | `.github/PULL_REQUEST_TEMPLATE.md` |
| Output file | `PR.md` (repo root)                |

---

## Workflow

### Step 1 — Read commit messages

```bash
git log main..HEAD --oneline
```

Read the **full** list. PRs in this repo routinely span 50–100 commits; never assume the set is small.

---

### Step 2 — Assess scope via stat

```bash
git diff main --stat
```

Scan affected files and line-change counts to understand areas of the codebase touched. This is usually sufficient.

---

### Step 3 — Inspect diffs (only when needed)

Read actual diffs **only** when commit messages and stat output leave ambiguity that would meaningfully improve description accuracy. Prefer targeted per-file reads over broad full-diff output.

```bash
git diff main -- <path/to/file>
```

Do not read every changed file — use judgment.

---

### Step 4 — Fill the PR template

Read `.github/PULL_REQUEST_TEMPLATE.md` and populate each section:

| Section                 | Action                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `## Description`        | Concise summary of what the PR does and why                                                                   |
| `## Related Issue`      | Include only if an issue number is referenced in commits or the branch name; otherwise **remove**             |
| `## Type of Change`     | Uncomment only the relevant emoji lines; remove the rest                                                      |
| `## Changes Made`       | Bullet list of meaningful change groups — **not** a raw dump of commit messages                               |
| `## Testing`            | Fill if test files were changed or testing context is derivable; otherwise **remove**                         |
| `## Screenshots/Videos` | Include only if UI/visual changes are evident; otherwise **remove**                                           |
| `## Checklist`          | Always keep; leave checkboxes as-is                                                                           |
| `## AI Assistance`      | Always fill: `GitHub Copilot was used to generate this PR description.`                                       |
| `## Additional Notes`   | Include only if there are breaking changes, performance notes, or special reviewer info; otherwise **remove** |
| `## CLA Requirement`    | Always keep                                                                                                   |

**Remove** any section (heading + HTML comments + body) whose content would be empty or not applicable.

---

### Step 5 — Generate the PR title

Rules:

- **Title Case** — capitalize principal words
- **Short and concise** — ≤72 characters preferred
- **No conventional commit prefix** — no `feat:`, `fix:`, `chore:` etc.
- Represents the whole PR scope, not any single commit

Print the title **before** writing the file:

```
PR Title: <Title Goes Here>
```

---

### Step 6 — Write PR.md

Write the completed template to `PR.md` in the repo root.

- Do **not** include the PR title inside `PR.md`; it is printed only in the chat message.
- Strip all remaining unfilled HTML comment placeholders.

---

## Section Removal Reference

| Section            | Remove when                                                | Always keep |
| ------------------ | ---------------------------------------------------------- | ----------- |
| Related Issue      | No issue found in commits or branch name                   |             |
| Testing            | No tests changed and no testing context is derivable       |             |
| Screenshots/Videos | No UI or visual changes present                            |             |
| Additional Notes   | No breaking changes, perf impact, or special reviewer info |             |
| Description        |                                                            | ✓           |
| Type of Change     |                                                            | ✓           |
| Changes Made       |                                                            | ✓           |
| Checklist          |                                                            | ✓           |
| AI Assistance      |                                                            | ✓           |
| CLA Requirement    |                                                            | ✓           |

---

## Definition of Done

- [ ] `git log main..HEAD --oneline` executed and full list reviewed
- [ ] `git diff main --stat` reviewed
- [ ] Diffs read selectively only where ambiguity warranted it
- [ ] All inapplicable template sections removed
- [ ] PR title printed in Title Case with no conventional commit prefix
- [ ] `PR.md` written to repo root with no unfilled placeholders
