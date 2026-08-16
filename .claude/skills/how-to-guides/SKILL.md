---
name: how-to-guides
description: Write and edit goal-oriented HyperFrontend documentation. Use when the reader has a specific task or problem to solve and needs practical directions to complete it.
---

# How-to guides

## Gate

Reader has a concrete goal and sufficient context to pursue it.

Learning a subject → `tutorials`  
Looking up facts → `reference`  
Understanding why → `explanation`

## Contract

- Address one real goal.
- Start where the reader starts.
- Lead to a working outcome.
- Assume competence.
- Include necessary choices and branching.
- Explain only what prevents successful completion.
- Link explanation and reference; do not reproduce them.
- Omit alternatives unrelated to the goal.

## Pattern

````md
# <Goal>

<Only prerequisites not safely assumed.>

## <Action>

<Instruction>

```ts
<working code>
```
````

## <Next action>

...

<How to verify the outcome.>

**Related:** [concept](...) · [reference](...)

```

Headings follow the task; do not impose this shape when it adds ceremony.

## Cut

Delete:

- background;
- conceptual teaching;
- self-evident code narration;
- API surveys;
- irrelevant alternatives;
- non-failure caveats;
- transitional prose.

Prefer deletion to rewriting. Prefer a link to a tangent.

## Checklist

- [ ] One concrete goal
- [ ] Shortest reliable path to completion
- [ ] Necessary decisions included
- [ ] Outcome verifiable
- [ ] Explanation/reference linked, not duplicated
- [ ] Every section advances the goal
```
