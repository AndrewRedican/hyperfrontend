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

```

Match the structure to the surface being documented; do not force API-shaped sections onto non-API reference.

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
```
