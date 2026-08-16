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
````

<What happened and the concept this step exposes.>

## <Next action>

...

<Working result and what the reader now understands.>

**Related:** [deeper concept](...) · [reference](...)

```

## Cut

Delete:

- optional branches;
- exhaustive API coverage;
- production variations;
- concepts not exercised by the build;
- explanation beyond the lesson;
- self-evident code narration.

Move practical variations to `how-to-guides`. Link deeper reasoning to `explanation`.

## Checklist

- [ ] One learning journey
- [ ] Reproducible starting point
- [ ] Learner succeeds by following the sequence
- [ ] Each step produces meaningful progress
- [ ] Concepts introduced through doing
- [ ] Unnecessary choices removed
- [ ] Ends with working software and acquired understanding
```
