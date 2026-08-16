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

A tutorial ships as a guide unit: `apps/docs-site/content/guides/<slug>/` holding `guide.md` and `meta.json`. Guides are docs-site editorial artifacts. A tutorial may teach a package, use its APIs, and link to its reference pages, but it never lives inside that package: nothing goes under `libs/<lib>/docs/`, because a file inside a publishable project makes Nx, CI, versioning, and publishing treat the package itself as changed. Read `meta.json` before writing and confirm `"type": "tutorial"`. A mismatch is a decision to make, not a formality: change the type or move the content, never leave the two disagreeing.

What the body must corroborate:

| Field           | Must agree with                                                                        |
| --------------- | -------------------------------------------------------------------------------------- |
| `type`          | the quadrant the body is written in                                                    |
| `title`         | the `guide.md` H1 (not enforced by the compiler; keep them identical)                  |
| `problem`       | the situation the opening puts the reader in                                           |
| `outcome`       | the working result the last step produces                                              |
| `prerequisites` | rendered above the body as "Before you start"; state them there, never in the body     |
| `related`       | rendered below the body as onward links; put every outbound link here, not in the body |
| `apis`          | the symbols the lesson teaches; validated against the generated API data               |
| `verification`  | `demo` requires `source`; `authored` requires `verifiedAgainst` + `verifiedOn`         |

`packages` is the only statement of which packages a guide concerns, since the filesystem no longer says. `packages[0]` is the package the tutorial is primarily about and decides which library page surfaces it; list every other package it genuinely involves after it, so a cross-cutting tutorial is reachable from all of them. Every entry must be a documented package. Slugs are global, flat, and must be unique: the directory name is the URL, and grouping folders are deliberately absent because `meta.json` already carries the taxonomy.

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

### Deep link instead of explaining

Every API symbol, option, and event gets a link on first mention, so the lesson stays on the build instead of turning into a tour of the surface. Miss no opportunity: if it has a name and a home, link it.

| Target                                   | Link to                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| A symbol exported by a workspace package | `/docs/libraries/<lib>[/<submodule>]#api-<ExactSymbolName>`              |
| A property of an exported type           | `…#api-<ExactSymbolName>-prop-<propertyName>`                            |
| A concept with no symbol                 | The owning page's H2/H3 slug, GitHub-style                               |
| A standard web or Node API               | MDN, or the runtime's own documentation                                  |
| A file in this repo                      | Its GitHub blob URL, labelled `path#Lstart-Lend`, introduced with `e.g.` |

Per-symbol and per-property `#api-` anchors are generated and stable; methods of an interface have none, so link the method to its owning type. Heading slugs are derived from prose, so verify the heading exists before linking to it. Nothing validates an anchor, so check it.

Name the package the learner installs, linked to its library page, in the opening or the install step. `meta.json` `packages` states it for machines; the body states it for the reader.

### Never document an absence

Write what the learner should do, never what the library lacks. A gap belongs under `_/`, not in the lesson. Where the learner's own build is genuinely incomplete, say what to add and link it.

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

### Punctuation

Em dashes are prohibited in `guide.md`, `README.md`, and JSDoc. Use a colon when the second clause explains the first, a semicolon when the clauses are co-equal, parentheses for an aside, or a full stop. The same applies to any prose these documents ship.

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
- [ ] `prerequisites` are checkable preconditions, not context
- [ ] Every symbol, concept, and standard API deep-linked on first mention
- [ ] No em dashes
