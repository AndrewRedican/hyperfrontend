---
name: skill-creator
version: 1.0.0
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

Skills encode operational workflows, not prose documentation. Interview the human first.

**Location:** `.github/skills/<name>/SKILL.md` (folder name = `name` field)

---

## Skill Anatomy

```
┌─ YAML Frontmatter          name, description (with "Use when" trigger)
├─ Title + Summary Line      One-line purpose
├─ Reference Locations       WHERE things live (table, not prose)
├─ Pre-action Gate           "Before X: Check Y" (error prevention)
├─ Taxonomy                  Categories, prefixes, naming conventions
├─ Critical Patterns         Copy-paste code blocks (no placeholders)
├─ Shared Utilities          MUST REUSE functions
├─ Testing / Verification    How to validate
└─ Checklist                 Definition of done
```

Omit sections that don't apply.

---

## Discovery Interview

Use `vscode_askQuestions` in batches before writing.

| Question                          | Maps To                             |
| --------------------------------- | ----------------------------------- |
| What domain/task does this cover? | Title, description                  |
| What triggers needing this skill? | Description keywords                |
| What does the human already know? | Knowledge boundaries (what to omit) |
| What burns people repeatedly?     | Critical Patterns section           |
| Where do files live? (paths)      | Reference Locations table           |
| What categories/prefixes exist?   | Taxonomy section                    |
| What utilities MUST be reused?    | Shared Utilities section            |
| How do you validate output?       | Testing section                     |
| What's the definition of done?    | Checklist                           |

---

## Writing Rules

| Rule             | Example                                            |
| ---------------- | -------------------------------------------------- |
| Tables for paths | `\| Rules \| tools/eslint-rules/src/rules/*.ts \|` |
| Imperative mood  | "Use", "Add", "Create" — not "You should..."       |
| Code = exact     | No `...` or `<placeholder>` — copy-paste ready     |
| Bold = mandatory | **MUST REUSE** — not "consider using"              |
| Show don't tell  | `✗ should report` → `✓ reports`                    |

---

## Knowledge Boundaries

| Include                 | Exclude                  |
| ----------------------- | ------------------------ |
| THIS repo's paths       | Domain fundamentals      |
| THIS repo's conventions | Language syntax          |
| THIS repo's gotchas     | Tool installation        |
| THIS repo's fixtures    | General testing concepts |

**Rule:** Official docs elsewhere → omit. Repo-specific convention → codify.

---

## Checklist

- [ ] `name` field matches folder name
- [ ] `description` has "Use when" trigger phrase
- [ ] Reference locations as table (if paths matter)
- [ ] Pre-action gate present (if checks needed)
- [ ] Code blocks copy-paste ready
- [ ] Checklist defines "done"
- [ ] Under 500 lines
