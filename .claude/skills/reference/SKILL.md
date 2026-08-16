---
name: reference
description: Write and edit information-oriented HyperFrontend documentation. Use when documenting APIs, configuration, contracts, options, states, errors, constraints, or other technical facts readers need to look up.
---

# Reference

## Gate

Reader needs authoritative information while working.

Learning by doing → `tutorials`  
Completing a task → `how-to-guides`  
Understanding why → `explanation`

## Metadata

Reference does not ship as a guide unit. `meta.json` admits `tutorial`, `how-to`, `troubleshooting`, and `recipe` only, so an `apps/docs-site/content/guides/<slug>/` directory is never the right home for it. An enumeration of states, options, or errors sitting inside a guide belongs here instead.

Reference lives in `README.md` beside the code it documents and in the generated API pages. Guides reach it through `related.reference` in their `meta.json`, which takes site routes that must resolve to a real page, and name the symbols they teach in `apis`, which is validated against the generated API data. Before moving facts out of a guide, confirm the reference page actually carries them; if it does not, write them there first.

## Contract

- Describe the system as it is.
- Be accurate, complete within scope, and authoritative.
- Structure documentation after the thing described.
- Optimize for lookup, not sequential reading.
- Use consistent structure and terminology.
- State behavior, inputs, outputs, defaults, constraints, and errors where applicable.
- Use examples to illustrate facts, not teach workflows.
- Keep interpretation and rationale out.

## Pattern

````md
## `createFeature(options)`

<What it is.>

### Parameters

| Name      | Type             | Description |
| --------- | ---------------- | ----------- |
| `options` | `FeatureOptions` | ...         |

### Returns

`Feature`

### Behavior

...

### Example

```ts
const feature = createFeature(...)
```
````

Match the structure to the surface being documented; do not force API-shaped sections onto non-API reference.

### Punctuation

Em dashes are prohibited in `guide.md`, `README.md`, and JSDoc. Use a colon when the second clause explains the first, a semicolon when the clauses are co-equal, parentheses for an aside, or a full stop. The same applies to any prose these documents ship.

## Cut

Delete:

- tutorials;
- task walkthroughs;
- architectural rationale;
- persuasion;
- history;
- opinions;
- speculative guidance.

Link outward when useful.

## Checklist

- [ ] Scope explicit
- [ ] Facts verified against source
- [ ] Structure mirrors the documented system
- [ ] Relevant facts complete within scope
- [ ] Terminology consistent
- [ ] No teaching or task narrative
- [ ] No rationale presented as reference
- [ ] No em dashes
