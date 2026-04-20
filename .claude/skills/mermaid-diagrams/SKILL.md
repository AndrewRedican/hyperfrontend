---
name: mermaid-diagrams
version: 1.0.0
description: Create Mermaid diagrams following hyperfrontend standards. Use when adding diagrams to documentation, creating flowcharts, sequence diagrams, or architecture visualizations. Enforces theme configuration and bans hardcoded colors.
---

# Mermaid Diagrams

All diagrams **MUST** include theme config. No hardcoded colors. No ASCII art.

---

## Required Config Block

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart TD
    A[Component] --> B[Component]
```

**Banned:** `style A fill:#hex` or any inline color styling.

**Exception:** `classDef` for layout only (no colors):

```mermaid
classDef cleanWide fill:none,stroke:none,text-align:left
```

---

## ASCII Art Ban

ESLint rule `no-ascii-art-diagrams` bans box-drawing: `┌┐└┘│─├┤┬┴┼`

Use Mermaid instead of ASCII diagrams.

- [ ] No `style X fill:#hex` statements
- [ ] No ASCII box-drawing characters
- [ ] `classDef` only for layout (no colors)
- [ ] Diagram type matches content purpose
