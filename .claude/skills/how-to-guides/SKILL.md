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

## Metadata

A how-to ships as a guide unit: `libs/<lib>/docs/guides/<slug>/` holding `guide.md` and `meta.json`. Read `meta.json` before writing and confirm `type` is `how-to`, `troubleshooting`, or `recipe`. A mismatch is a decision to make, not a formality: change the type or move the content, never leave the two disagreeing.

What the body must corroborate:

| Field           | Must agree with                                                                         |
| --------------- | --------------------------------------------------------------------------------------- |
| `type`          | the quadrant the body is written in                                                     |
| `title`         | the `guide.md` H1 (not enforced by the compiler; keep them identical)                   |
| `problem`       | the goal the opening states                                                             |
| `outcome`       | what the reader has after the last step                                                 |
| `prerequisites` | rendered above the body — state them there, never repeat them in the body               |
| `related`       | rendered below the body as onward links — put every outbound link here, not in the body |
| `apis`          | the symbols the body teaches; validated against the generated API data                  |
| `demo`          | the shipped demo the snippets come from                                                 |
| `verification`  | `demo` requires `source`; `authored` requires `verifiedAgainst` + `verifiedOn`          |

`packages[0]` must be the owning library's package name. Slugs are global and must be unique.

Code arrives through `<!-- snippet: <region> -->` placeholders resolved out of `verification.source` and `snippetSources`. Every placeholder needs a region and every region needs a placeholder. Each rendered snippet already carries a link to its source file and line range, so never restate that path in prose.

## Contract

- Address one real goal.
- Start where the reader starts.
- Number the steps; one action per step.
- Write directions that hold for the reader's own codebase.
- Let the snippet and its source link carry the worked implementation; name the demo once.
- Lead to a working outcome.
- Assume competence.
- Include necessary choices and branching.
- Explain only what prevents successful completion.
- Link explanation and reference; do not reproduce them.
- Omit alternatives unrelated to the goal.

## Pattern

````md
# <Goal>

<Only prerequisites not safely assumed. One line naming where the snippets come from.>

## 1. <Action>

<Instruction>

```ts
<working code>
```

## 2. <Next action>

...

## Check it worked

<How to verify the outcome, against the reader's own build.>
````

Headings follow the task; do not impose this shape when it adds ceremony. The guide ends on verification: onward links are rendered from `related`, so a hand-written trailer only competes with them. Link inline where a specific sentence needs it.

## Cut

Delete:

- background;
- conceptual teaching;
- demo narration — what the example app does, rather than what the reader does;
- self-evident code narration;
- API surveys;
- irrelevant alternatives;
- non-failure caveats;
- transitional prose.

Prefer deletion to rewriting. Prefer a link to a tangent.

## Checklist

- [ ] `meta.json` `type` matches, and `title`/`problem`/`outcome` match the body
- [ ] One concrete goal
- [ ] Steps numbered, one action each
- [ ] Directions generalize past the worked example
- [ ] Shortest reliable path to completion
- [ ] Necessary decisions included
- [ ] Outcome verifiable
- [ ] Explanation/reference linked, not duplicated
- [ ] Every section advances the goal
