---
name: skill-creator
version: 1.1.0
description: Create high-quality SKILL.md files for agent customization. Use when building domain skills, packaging workflows, or codifying team conventions. Produces terse, scannable, copy-paste-ready skills.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Terminal
  - AskQuestions
---

# Skill Creator

Skills encode operational workflows, not prose. **Interview the human first.**

**Location:** `.github/skills/<name>/SKILL.md` (folder name = `name` field)

---

## Skill Anatomy

```
┌─ YAML Frontmatter          name, description (with "Use when" triggers)
├─ Title + Summary           One-line purpose
├─ Reference Locations       WHERE things live (table, not prose)
├─ Pre-action Gate           "Before X: Check Y" (error prevention)
├─ Taxonomy                  Categories, prefixes, naming conventions
├─ Critical Patterns         Copy-paste code blocks (no placeholders)
├─ Shared Utilities          MUST REUSE functions
├─ Testing                   How to validate
└─ Checklist                 Definition of done
```

Omit sections that don't apply.

---

## Discovery Interview

Use `vscode_askQuestions` before writing:

| Question                   | Maps To             |
| -------------------------- | ------------------- |
| Domain/task?               | Title, description  |
| Trigger keywords?          | Description         |
| User's existing knowledge? | What to omit        |
| Repeated pain points?      | Critical Patterns   |
| File paths?                | Reference Locations |
| Categories/prefixes?       | Taxonomy            |
| Required shared utilities? | Shared Utilities    |
| Validation method?         | Testing             |
| Definition of done?        | Checklist           |

---

## Writing Rules

| Rule             | Example                                            |
| ---------------- | -------------------------------------------------- |
| Tables for paths | `\| Rules \| tools/eslint-rules/src/rules/*.ts \|` |
| Imperative mood  | "Use", "Add" — not "You should..."                 |
| Code = exact     | No `...` or `<placeholder>`                        |
| Bold = mandatory | **MUST REUSE** — not "consider using"              |
| Show don't tell  | ✗ "should report" → ✓ "reports"                    |

---

## Description

Agent sees **only** the description when choosing skills.

**Format:** ≤1024 chars · Third person · "Use when [triggers]" in second sentence.

| Quality | Example                                                                                    |
| ------- | ------------------------------------------------------------------------------------------ |
| ✓ Good  | `Extract/fill/merge PDFs. Use when working with PDF files, forms, or document extraction.` |
| ✗ Bad   | `Helps with documents.`                                                                    |

---

## Scripts & Splitting

**Add script when:** deterministic operation, repeated codegen, explicit error handling needed.

**Split to `REFERENCE.md` when:** SKILL.md > 100 lines or distinct sub-domains.

---

## Knowledge Boundaries

Codify repo-specific; omit what's in official docs elsewhere.

| Include                 | Exclude             |
| ----------------------- | ------------------- |
| THIS repo's paths       | Domain fundamentals |
| THIS repo's conventions | Language syntax     |
| THIS repo's gotchas     | Tool installation   |
| THIS repo's fixtures    | General concepts    |

---

## Checklist

- [ ] `name` matches folder name
- [ ] `description` ≤1024 chars, third-person, "Use when" triggers
- [ ] Paths as table
- [ ] Pre-action gate if checks needed
- [ ] Code blocks copy-paste ready
- [ ] Checklist defines done
- [ ] <500 lines; split if >100
