---
name: tutorials
description: Write and edit learning-oriented HyperFrontend documentation. Use when the reader needs to learn a subject through a guided, practical experience that produces a working result.
---

# Tutorials

## Gate

Reader wants to learn through doing. Assume minimal context.

Completing a known task → `how-to-guides`  
Looking up facts → `reference`  
Understanding why → `explanation`

## Metadata

A tutorial ships as a guide unit: `libs/<lib>/docs/guides/<slug>/` holding `guide.md` and `meta.json`. Read `meta.json` before writing and confirm `"type": "tutorial"`. A mismatch is a decision to make, not a formality: change the type or move the content, never leave the two disagreeing.

What the body must corroborate:

| Field           | Must agree with                                                                         |
| --------------- | --------------------------------------------------------------------------------------- |
| `type`          | the quadrant the body is written in                                                     |
| `title`         | the `guide.md` H1 (not enforced by the compiler; keep them identical)                   |
| `problem`       | the situation the opening puts the reader in                                            |
| `outcome`       | the working result the last step produces                                               |
| `prerequisites` | rendered above the body — state them there, never repeat them in the body               |
| `related`       | rendered below the body as onward links — put every outbound link here, not in the body |
| `apis`          | the symbols the lesson teaches; validated against the generated API data                |
| `verification`  | `demo` requires `source`; `authored` requires `verifiedAgainst` + `verifiedOn`          |

`packages[0]` must be the owning library's package name. Slugs are global and must be unique.

Tutorial code is usually written for the lesson rather than extracted from a demo, which makes `verification.kind` `authored`. Run every example before you publish, then stamp `verifiedAgainst` with the package version and `verifiedOn` with the date you ran it. Re-run and re-stamp whenever you touch the code. Code that does not compile fails this quadrant outright.

## Contract

- Teach through a concrete, working experience.
- Own the learner's successful journey.
- Start from a reproducible state.
- Build one thing in a deliberate sequence.
- Give the learner actions, then observable results.
- Make necessary decisions for the learner.
- Introduce concepts when the learner encounters them.
- Explain only what the chosen lesson requires.
- Prefer concrete examples over abstraction.
- End with both a working result and acquired understanding.

Reliability outranks realism. The learner is here to learn, not navigate unnecessary choices.

## Pattern

````md
# <Thing the reader will build>

<What they will build and learn.>

## <First meaningful action>

<Instruction>

```ts
<working code>
```

<What happened and the concept this step exposes.>

## <Next action>

...

<Working result and what the reader now understands.>
````

The tutorial ends on the result: onward links are rendered from `related`, so a hand-written trailer only competes with them.

## Cut

Delete:

- optional branches;
- exhaustive API coverage;
- production variations;
- concepts not exercised by the build;
- explanation beyond the lesson;
- self-evident code narration;
- flourish in headings and closing lines.

Move practical variations to `how-to-guides`. Link deeper reasoning to `explanation`.

## Checklist

- [ ] `meta.json` `type` is `tutorial`, and `title`/`problem`/`outcome` match the body
- [ ] Every example compiles and runs, stamped in `verification`
- [ ] One learning journey
- [ ] Reproducible starting point
- [ ] Learner succeeds by following the sequence
- [ ] Each step produces meaningful progress
- [ ] Concepts introduced through doing
- [ ] Unnecessary choices removed
- [ ] Ends with working software and acquired understanding
