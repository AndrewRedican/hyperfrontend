---
name: architecture-docs
version: 1.0.0
description: Write ARCHITECTURE.md files for hyperfrontend libraries. Use when creating architecture documentation, documenting design decisions, adding system overview diagrams, or explaining module composition and data flow.
---

# Architecture Docs

Create ARCHITECTURE.md at `libs/<name>/ARCHITECTURE.md`.

Explains **how** a system is designed—not usage (that's README.md).

---

## Required Sections

1. **System Overview** — Mermaid flowchart + brief prose
2. **Design Principles** — Numbered list with ✅/❌ code examples
3. **Module Composition** — Table mapping modules to responsibilities
4. **Data Flow** — Sequence diagram for key operations
5. **Core Interfaces** — Primary TypeScript contracts
6. **Links** — Point to README.md and src/README.md

---

## Checklist

- [ ] All six sections present
- [ ] Mermaid diagrams use `theme: base`
- [ ] No installation/usage content/project directory tree
