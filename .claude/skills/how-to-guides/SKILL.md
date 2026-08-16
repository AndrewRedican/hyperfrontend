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

A how-to ships as a guide unit: `apps/docs-site/content/guides/<slug>/` holding `guide.md` and `meta.json`. Guides are docs-site editorial artifacts. A guide may describe a package, use its APIs, and link to its reference pages, but it never lives inside that package: nothing goes under `libs/<lib>/docs/`, because a file inside a publishable project makes Nx, CI, versioning, and publishing treat the package itself as changed. Read `meta.json` before writing and confirm `type` is `how-to`, `troubleshooting`, or `recipe`. A mismatch is a decision to make, not a formality: change the type or move the content, never leave the two disagreeing.

What the body must corroborate:

| Field           | Must agree with                                                                        |
| --------------- | -------------------------------------------------------------------------------------- |
| `type`          | the quadrant the body is written in                                                    |
| `title`         | the `guide.md` H1 (not enforced by the compiler; keep them identical)                  |
| `problem`       | the goal the opening states                                                            |
| `outcome`       | what the reader has after the last step                                                |
| `prerequisites` | rendered above the body as "Before you start"; state them there, never in the body     |
| `related`       | rendered below the body as onward links; put every outbound link here, not in the body |
| `apis`          | the symbols the body teaches; validated against the generated API data                 |
| `demo`          | the shipped demo the snippets come from                                                |
| `verification`  | `demo` requires `source`; `authored` requires `verifiedAgainst` + `verifiedOn`         |

`packages` is the only statement of which packages a guide concerns, since the filesystem no longer says. `packages[0]` is the package the guide is primarily about and decides which library page surfaces it; list every other package the guide genuinely involves after it, so a cross-cutting guide is reachable from all of them. Every entry must be a documented package. Slugs are global, flat, and must be unique: the directory name is the URL, and grouping folders are deliberately absent because `meta.json` already carries the taxonomy.

Code arrives through `<!-- snippet: <region> -->` placeholders resolved out of `verification.source` and `snippetSources`. Every placeholder needs a region and every region needs a placeholder. Each rendered snippet already carries a link to its source file and line range, so never restate that path in prose.

## Contract

- Address one real goal.
- Open with what the reader will be able to do, then why it is worth doing. The problem framing follows that, not the reverse.
- Start where the reader starts.
- Number the steps; one action per step.
- Write directions that hold for the reader's own codebase.
- Lead to a working outcome.
- Assume competence.
- Include necessary choices and branching.
- Explain only what prevents successful completion.
- Omit alternatives unrelated to the goal.

### Separate the general step from the worked example

The step body is the instruction any reader can follow. Everything specific to the example app (its nouns, its layout, its numbers) belongs with the linked code, not in the instruction. Introduce the example's provenance once, in the opening, as a sentence that reads like prose rather than a build note. Where a general instruction has a verbatim implementation and no snippet of its own, append `[(example)](url)` pointing at it.

### Deep link instead of explaining

Every API symbol, option, event, error reason, and named concept gets a link on first mention, so the guide never spends a paragraph on something a reference page already carries. Miss no opportunity: if it has a name and a home, link it.

| Target                                   | Link to                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| A symbol exported by a workspace package | `/docs/libraries/<lib>[/<submodule>]#api-<ExactSymbolName>`              |
| A concept with no symbol                 | The owning page's H2/H3 slug, GitHub-style                               |
| A standard web or Node API               | MDN, or the runtime's own documentation                                  |
| A file in this repo                      | Its GitHub blob URL, labelled `path#Lstart-Lend`, introduced with `e.g.` |

Per-symbol `#api-` anchors are generated and stable. Heading slugs are derived from prose, so verify the heading exists before linking to it. Nothing validates an anchor, so check it.

### Never document an absence

Write what the reader should do, never what the library lacks. "There is no X" and "the SDK gives you no way to Y" are gaps, not documentation: record them under `_/` and mention them in prose only once the work lands. State the working approach positively instead.

## Pattern

````md
# <Goal>

<What the reader will be able to do, and why it matters.>

<The situation that makes it necessary.>

<Where the code examples come from.>

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

### Punctuation

Em dashes are prohibited in `guide.md`, `README.md`, and JSDoc. Use a colon when the second clause explains the first, a semicolon when the clauses are co-equal, parentheses for an aside, or a full stop. The same applies to any prose these documents ship.

## Cut

Delete:

- background;
- conceptual teaching a link can carry;
- demo narration: what the example app does, rather than what the reader does;
- statements of what the library does not provide;
- self-evident code narration;
- API surveys;
- irrelevant alternatives;
- non-failure caveats;
- transitional prose.

Prefer deletion to rewriting. Prefer a link to a tangent.

## Checklist

- [ ] `meta.json` `type` matches, and `title`/`problem`/`outcome` match the body
- [ ] One concrete goal
- [ ] Opening states what the reader will be able to do, and why
- [ ] Steps numbered, one action each
- [ ] Directions generalize past the worked example; its specifics sit with the linked code
- [ ] Every symbol and concept deep-linked on first mention, to a heading that exists
- [ ] No absence documented; gaps recorded under `_/` instead
- [ ] Shortest reliable path to completion
- [ ] Necessary decisions included
- [ ] Outcome verifiable against the reader's own build
- [ ] Every section advances the goal
- [ ] `prerequisites` are checkable preconditions, not context or restated steps
- [ ] No em dashes
