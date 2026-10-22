---
name: skill-creator
description: Create SKILL.md files. Use when building domain skills, packaging workflows, or codifying conventions.
---

# Skill Creator

**Maximum information compression.** Every word earns its place. What readers infer, omit.

Interview first: domain, triggers, pain points, paths, validation, done-criteria → maps directly to skill sections.

**Location:** `.claude/skills/<name>/SKILL.md`

---

## Anatomy

```
YAML Frontmatter   name, description ("Use when" triggers)
Title              One line
Paths              Table: role → glob
Gate               "Before X: Check Y"
Patterns           Copy-paste blocks (no placeholders)
Checklist          Done = all checked
```

Omit what doesn't apply.

---

## Compression Principles

| Principle        | ✗ Verbose                         | ✓ Compressed                    |
| ---------------- | --------------------------------- | ------------------------------- |
| Imperative       | "You should use..."               | "Use"                           |
| Show don't tell  | "The function should report"      | "Reports"                       |
| Examples > prose | "Format paths as tables because…" | `\| Rules \| src/rules/*.ts \|` |
| Inference        | "Since TypeScript compiles to…"   | (omit—reader knows)             |
| Signpost         | Re-explain AST traversal here     | See `lint-rules` skill          |
| Bold = mandatory | "Consider reusing"                | **MUST REUSE**                  |
| Code = exact     | `doThing(<your-value>)`           | `doThing('actual-value')`       |

**Test:** Delete a word. Meaning lost? Keep it. Otherwise, cut.

---

## Frontmatter

**`name` + `description` only.** Spec: [Claude Code skills](https://code.claude.com/docs/en/skills); VS Code reads `.claude/skills/` too.

| Field                                                                             | Rule                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                                                            | = folder name; lowercase, digits, hyphens; ≤64 chars (VS Code skips others silently)                                                                                             |
| `description`                                                                     | ≤1024 chars (VS Code cap), third person, key use case first, "Use when [triggers]."                                                                                              |
| `disable-model-invocation`, `user-invocable`, `argument-hint`, `paths`, `context` | Only when the skill must behave differently                                                                                                                                      |
| `version`, `license`, `allowed-tools`                                             | **Never.** Git versions files; repo `LICENSE.md` covers skills; permissions live in `.claude/settings.json` (`allowed-tools` pre-approves tools, bypassing its `ask` guardrails) |

Agent sees **only** description when choosing.

✓ `Extract/fill/merge PDFs. Use when working with PDF files or forms.`
✗ `Helps with documents.`

---

## Boundaries

**Include:** this repo's paths, conventions, gotchas.
**Exclude:** domain fundamentals, language syntax, tool installation—reader knows or finds elsewhere.

---

## Split & Script

Split to `REFERENCE.md` at ~100 lines or distinct sub-domains. Link every supporting file from `SKILL.md`, saying what it holds.
Add script when: deterministic, repeated, needs explicit error handling.

---

## Checklist

- [ ] Frontmatter is `name` + `description` only (exceptions per table)
- [ ] `name` = folder name
- [ ] Description: ≤1024 chars, third-person, "Use when"
- [ ] Paths as table
- [ ] Code blocks copy-paste ready
- [ ] <500 lines
