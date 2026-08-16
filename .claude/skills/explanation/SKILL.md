---
name: explanation
description: Write and edit understanding-oriented HyperFrontend documentation. Use when explaining concepts, architecture, design decisions, relationships, constraints, trade-offs, or why the system behaves as it does.
---

# Explanation

## Gate

Reader wants to understand a subject, not complete an immediate task.

Learning by doing → `tutorials`  
Completing a task → `how-to-guides`  
Looking up facts → `reference`

## Metadata

Explanation does not ship as a guide unit. `meta.json` admits `tutorial`, `how-to`, `troubleshooting`, and `recipe` only, so a `docs/guides/<slug>/` directory is never the right home for it. If you are writing explanation there, you are in the wrong quadrant.

Explanation lives in `ARCHITECTURE.md` beside the code it explains, and in the site's concept pages. Guides reach it through `related.explanation` in their `meta.json`, which takes site routes that must resolve to a real page. When a guide sheds rationale, that is where the rationale lands.

## Contract

- Deepen understanding of one bounded subject.
- Explain why, not merely what.
- Connect concepts the reader may otherwise see independently.
- Expose relevant relationships, constraints, consequences, and trade-offs.
- Use examples to clarify ideas, not create a procedure.
- Assume the reader can follow links for factual detail.
- Permit exploration only while it strengthens the chosen subject.

Explanation may be discursive. It may not be unfocused.

## Pattern

```md
# <Concept>

<The idea or question being explained.>

## <Meaningful dimension>

<Explanation, relationships, consequences, or trade-offs.>

## <Meaningful dimension>

...

**Related:** [reference](...) · [practical application](...)
```

Do not impose sections that the subject does not need.

### Punctuation

Em dashes are prohibited in `guide.md`, `README.md`, and JSDoc. Use a colon when the second clause explains the first, a semicolon when the clauses are co-equal, parentheses for an aside, or a full stop. The same applies to any prose these documents ship.

## Cut

Delete:

- step-by-step instructions;
- API inventories;
- implementation details that do not affect understanding;
- tangential concepts;
- repeated conclusions;
- throat-clearing;
- prose whose only purpose is transition.

## Checklist

- [ ] One bounded subject
- [ ] Increases understanding rather than task completion
- [ ] Important relationships made explicit
- [ ] Relevant rationale/trade-offs covered
- [ ] Reference facts linked rather than duplicated
- [ ] No procedural drift
- [ ] Every section strengthens the central idea
- [ ] No em dashes
