---
title: 'I Replaced ESLint. The First Attempt Worked. I Threw It Away.'
description: 'Removing dependencies was easy compared with deciding how much of their code I actually wanted to own.'
date: '2026-10-23'
author: 'Andrew Redican'
readingTime: '6 min read'
category: 'field-notes'
tags: 'linting, eslint, dependencies, supply chain, parsers, ai-assisted engineering, tooling'
packages: '@hyperfrontend/linter'
related: 'i-replaced-jest-with-1200-lines-of-code, complete-architectural-sovereignty'
heroImage: '/articles/i-replaced-eslint-the-first-attempt-worked-i-threw-it-away/hero.webp'
---

![A house with its front door open hands a key along an arrow to a box labelled eslint, from which arrows fan out to three boxes each holding a copy of the key, then to more boxes, then to more, the tree of keys thinning into the distance](/articles/i-replaced-eslint-the-first-attempt-worked-i-threw-it-away/hero.webp)

I am tired of fixing vulnerabilities in code I never consciously chose.

Not because the maintainers did something wrong. Usually they solved a real problem, and somebody else used their solution to solve another one. Eventually that chain reached my build pipeline, and its maintenance became part of my week.

I chose a linter. I also acquired a collection of decisions about parsing, configuration, compatibility and environments that looked nothing like mine. When an advisory arrived somewhere underneath, I had another job before I could return to the software I actually wanted to build.

In [my earlier Jest migration](https://www.hyperfrontend.dev/articles/i-replaced-jest-with-1200-lines-of-code/), Node’s test runner and roughly 1,200 lines of compatibility code replaced hundreds of packages. That made linting an obvious next experiment.

It was considerably less obvious how to finish it.

## The subcontractors have keys

Imagine hiring someone to clean your house while you are away. They subcontract the kitchen, who subcontract the oven, who bring someone else to clean the glass. You return to discover that a hundred people were involved. Most did excellent work. You would still have preferred to know who could enter your house.

![Two photographs side by side. On the left, a homeowner at their front door hands a key to a smiling cleaner holding a caddy of spray bottles and cloths. On the right, four people in the same kitchen, one washing a dish at the sink, one shining a torch into a cupboard, one leafing through papers in a drawer and one kneeling at a pulled-out drawer with a brush](/articles/i-replaced-eslint-the-first-attempt-worked-i-threw-it-away/subcontractors-have-keys.webp)

A dependency graph is not literally a queue of people with your keys. Permissions and execution matter. But development tools run inside environments that can contain source code, credentials and release authority. “It’s only a dev dependency” does not make that trust irrelevant.

Open source lets me inspect the arrangement. It does not mean I have inspected it, or that someone else has inspected precisely what my pipeline executes. I used to treat installing a familiar package as the end of that decision. Increasingly, I want it to be the beginning.

LLMs made this experiment practical for me. They lowered the effort of implementing bounded behaviour. They did not remove the work of deciding what that behaviour should be, or proving that the implementation delivered it.

## I successfully built something I didn’t want

My first approach was conservative: copy the installed linting dependency closure, disconnect the packages, and progressively remove what the workspace did not need.

The copy contained **630 packages, 18,317 files and 188 MB**. That included integrations and supporting machinery, not 188 MB of ESLint source.

We traced module loading, inspected references, removed unused rules, replaced compatibility helpers with native operations, and converted the survivors into TypeScript ES modules. The early reductions were enormous. Later reductions mostly became relocations: code left a dependency directory and reappeared under my own source tree.

After six phases, the linter worked. It had more than 30,000 passing tests. Its active implementation was still **16.2 MB**, including a generated 9.17 MB copy of the TypeScript compiler.

I had succeeded at taking responsibility for the code. I had barely changed the problem it was designed to solve.

The compiler arrangement finally made that impossible to ignore. It was too large for my repository’s per-file budget, so every lint run depended on a generation step. I had spent days removing an ecosystem and ended up maintaining a local version of much of it.

I kept that working implementation as a reference and started again.

<!-- media: mid-article illustration "Ownership without simplification" goes here. Same palette: an engineer beside an enormous reconstructed machine filling a small workshop, holding a tiny blank ownership plaque, with a modest hand-drawn mechanism on the workbench. Suggested caption: "The machine was mine. So was everything required to keep it running." Approved asset not yet supplied. -->

## This time, count the requirements

ESLint has to accommodate different languages, plugins, configurations and ways of working. Those requirements are real. I could choose one workspace and accept its limits.

The second attempt began with a survey of what the enabled rules actually asked the engine to do.

No enabled rule required TypeScript type information. Three required control-flow analysis. The selector engine served one rule’s fixed configuration. The YAML check read raw lines. Ten of fourteen Markdown rules did too.

Those facts changed the architecture more than another round of deleting files could have.

I still needed syntax trees. A rule cannot forbid a construct if the parser cannot recognise it. Typechecking could stay with the compiler elsewhere in the toolchain. Linting needed nodes, names and source positions. Unlike the Jest migration, there was no native engine to hand this work to.

The new scanner and recursive-descent parser started at roughly 4,300 lines. Its scanner was parser-directed: `/` could become a regular expression when the grammar required one; a closing brace could resume a template literal; JSX text was scanned in JSX context. This was real parsing, not regular expressions pretending to understand TypeScript.

The engine became equally direct: parse a file once, group applicable rule listeners by node kind, walk the tree once, collect diagnostics, and apply fixes. If fixes changed the text, repeat, with a ten-pass limit. Load only the rules that configuration enables for that file.

<!-- media: optional precise vector diagram "One traversal, many rules" goes here, in place of an illustration: configuration selects applicable rules (lazy loading at selection); source enters a language parser; the tree feeds one traversal with listeners grouped by node kind; reports and fixes come out; changed text loops back to parsing, capped at ten passes. Six main elements at most, the fix loop visually distinct, no implication that scope or control-flow analysis is never needed. Suggested caption: "Rules share the traversal. Only the configured behaviour is loaded." -->

The complexity that remained had a job I could name.

## Make the old system answer questions

The first implementation was too large to keep, but exceptionally useful as a reference you could execute.

We fed the same inputs to both systems and compared messages, positions and fixed output. The installed TypeScript compiler became a development-time reference for tokens and parse verdicts, rather than a runtime dependency. The old parser supplied expected tree shapes; Nx supplied the reference project graph.

For someone attempting this, the sequence matters:

1. Inventory the behaviour your configurations actually enable.
2. Capture clean files **and deliberate violations** before removing the reference.
3. Replace one layer and compare its observable output.
4. Prove the comparison catches a planted difference.
5. Keep regression cases that explain the behaviour you now own.

A clean repository producing no warnings is weak evidence. A linter that silently stops running its rules can produce exactly that result. We learned this when an early reduction removed three Nx-provided checks along with their integration. All three were restored, with reports and fixes checked against the originals. Their disappearance had made a passing run easier to obtain.

The rewrite’s final comparison covered **6,456 files and 655 mutation inputs**, with differences individually investigated. Its retained suite finished at **4,993 tests and 100% measured line, branch and function coverage**. That coverage tells me which code ran; it does not establish universal correctness or full TypeScript conformance.

## A smaller responsibility is still a responsibility

The replacement ended at roughly **1.7 MB of implementation**, with 200 rules and no external npm packages loaded during linting. It uses Node, Git and existing HyperFrontend packages. The full lint command took **90 seconds**, compared with earlier runs of 229–278 seconds on the same shared development machine. Useful evidence, not a controlled benchmark.

These numbers describe a tool built for one workspace. They do not describe a smaller drop-in ESLint for everybody.

Whether the time saved will repay the work is still unproven. It occupied most of a week, including interruptions and a working implementation I declined to keep. The independent review still found questionable rules, unnecessary options and integration defects.

I now own its parser and its bugs. Supporting new syntax can pull me away from product work just as an advisory did. Fewer external maintainers also means more dependence on me. Tests and documentation help somebody else take over; they do not supply that person.

Editor integration was lost too. I can accept running lint from the terminal. A team relying on immediate feedback in its editor may reject that exchange. Supported scope, workflow and maintenance ownership need agreement before a rewrite. My preferences cannot make that decision for somebody else’s team.

Since then I have packaged it as [@hyperfrontend/linter](/docs/libraries/linter), which makes me somebody else’s subcontractor. Of its 200 rules, 156 were general enough to ship; the rest enforce this repository’s own layout and release practice, and they stayed behind. A smaller implementation does not automatically deserve anyone’s trust. Every consumer can turn a deliberate omission into a feature request, so the package says what it does not do before anyone installs it, and I have to be clear about which requirements I am willing to take on.

The first attempt asked how much of the existing solution I could remove. The second asked what had to exist to enforce my rules. Both produced green checks. Only one produced code I was willing to maintain.

That is the question I now want answered before installing another tool: **what responsibility am I accepting, and is this the shape in which I want to own it?**

- Do you want to see the actual code changes? [PR #176](https://github.com/AndrewRedican/hyperfrontend/pull/176) replaced ESLint and its Nx integration with the workspace linter.
- On the same journey? Hand the [de-eslint skill](https://github.com/AndrewRedican/hyperfrontend/tree/main/.claude/skills/de-eslint) to your coding agent: it carries the method, from inventory to removal.
- Trying the package? Start with [How to lint a project with @hyperfrontend/linter](/docs/guides/lint-a-project-with-hyperfrontend-linter), then [How to replace ESLint with @hyperfrontend/linter](/docs/guides/replace-eslint-with-hyperfrontend-linter). Checks of your own go in [a custom rule](/docs/guides/write-and-test-a-custom-lint-rule).
