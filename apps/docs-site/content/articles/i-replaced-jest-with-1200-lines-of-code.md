---
title: "I Replaced Jest With 1,200 Lines of Code. I'd Do It Again."
description: 'Moving 11,900 tests from Jest onto node:test removed 457 packages from the lockfile, found product bugs the old runner had hidden, and changed how I think about what code reuse costs.'
date: '2026-09-05'
updated: '2026-10-16'
author: 'Andrew Redican'
readingTime: '13 min read'
heroImage: '/articles/i-replaced-jest-with-1200-lines-of-code/hero.webp'
category: 'field-notes'
tags: 'testing, jest, dependencies, supply chain, coverage, ai-assisted engineering, tooling'
packages: '@hyperfrontend/testing'
related: 'hyperfrontend-the-long-way-around, complete-architectural-sovereignty'
mediumUrl: 'https://medium.com/@andrew.redican.mejia/i-replaced-jest-with-1-200-lines-of-code-id-do-it-again-d852187f04ac'
---

![A cartoon developer opens a box labelled jest while a crowd of smiling boxes named @babel/core, @jest/transform, chalk, yargs, semver and 450 more march out of a warehouse behind it, under a sign reading "Same package. A bigger family than you expected."](/articles/i-replaced-jest-with-1200-lines-of-code/hero.webp)

There was a time when installing a package was almost always cheaper than writing the code yourself.

I am unconvinced that this still holds true.

The JavaScript ecosystem I met a little over a decade ago grew up around a language and a platform that were missing a lot of things. Testing is a good example. If you wanted a serious test harness, assertions, mocking, fake timers, coverage, DOM environments and a reasonable developer experience, the platform wasn't going to give you those things.

The ecosystem did.

Tools like Jest solved real problems, and solved them extraordinarily well. The same is true across much of npm. The enormous package ecosystem we have today is one of the reasons JavaScript became as productive and ubiquitous as it did.

But platforms evolve.

Node has evolved.

And, perhaps more importantly, the economics of writing software have changed.

So I recently asked what sounds like a slightly unreasonable question:

**Do I actually need Jest anymore?**

No, I don't think Jest is bad. It has been my reliable, go-to test harness for a very long time. But more and more, I find myself scrutinising what an open-source package pulls into my dependency graph. Part of that is a "less is more" instinct, which has served me well.

Most of it is lived experience. I have spent too many hours chasing security advisories through transitive dependencies I never chose. It pulls me completely out of my zone and away from my core interest: actually building software.

But I am getting ahead of myself.

For this particular codebase, the question I asked myself was:

**Is continuing to outsource this functionality still a good trade?**

The answer turned into a migration of roughly 11,900 tests across 934 spec files, containing about 18,000 assertions, from Jest to Node's built-in `node:test`.

I didn't replace Jest with Vitest or another test framework.

I replaced it with the platform and roughly 1,200 lines of repository-local compatibility code.

By the time the work was finished, 457 packages had disappeared from the root lockfile.

But that number isn't actually the most interesting thing I got out of it.

![Screenshot of the @nx/jest dependency graph on npm.anvaka.com: hundreds of packages linked around @nx/jest, jest-runner, @babel/core and nx](/articles/i-replaced-jest-with-1200-lines-of-code/nx-jest-dependency-graph.webp)

_Screenshot from [npm.anvaka.com](https://npm.anvaka.com/) of the @nx/jest dependency graph_

## Dependencies are not free code

"Don't reinvent the wheel" is probably one of the most repeated pieces of software engineering advice.

Closely related is the argument for code reuse: why write something yourself when somebody else has already written it, tested it, documented it and maintained it?

That's generally sensible.

But I think we've allowed "code reuse" to become an argument that sometimes ends the analysis when it should start it.

Imagine I need 100 lines of functionality.

I can write and own those 100 lines, or I can install a package containing 10,000 lines which itself installs dozens of other packages.

The second option certainly involves less typing.

It does not necessarily involve less engineering.

Those dependencies become code I have chosen to trust. Their dependencies become code I have chosen to trust. Their release processes, maintainers, install scripts, vulnerabilities, compatibility decisions and supply chains become relevant to my software.

Even development dependencies deserve more scrutiny than the name suggests.

They might not ship inside the artifact my customer installs, but they are part of the production line that manufactures the artifact.

The conveyor belt matters too.

The project I am working on, [HyperFrontend](https://hyperfrontend.dev/), already takes this philosophy fairly seriously. Its libraries are designed to have standalone value and, where practical, ship without dragging an ecosystem behind them. Applications and demos living in the same monorepo have their own package boundaries and dependency trees because they have different requirements.

But the root workspace still contained the equipment required to build and test everything.

That made Jest an interesting place to test the philosophy against reality.

## AI changes one side of the equation

There is another uncomfortable reason I think we need to revisit some old assumptions.

Writing code is getting cheaper.

That doesn't make code free, and generated code doesn't maintain itself, or review itself. But implementing a small, bounded piece of infrastructure is considerably less expensive than it used to be.

I can't put a number on that saving. I didn't time this migration against a version of me working without an LLM, and it is a sample of one. What I can say is where the effort went: rarely into writing the code, mostly into proving it was telling the truth.

That changes the build-versus-buy equation.

A few years ago, avoiding 1,200 lines of bespoke testing infrastructure might have been an overwhelmingly compelling reason to install a framework.

Today I can ask a different question:

**Would I rather understand and own 1,200 lines designed exclusively for my repository, or inherit a much larger general-purpose dependency graph designed to accommodate thousands of repositories that look nothing like mine?**

There is no universal answer to that.

But "obviously the package" is no longer a satisfactory one either.

## Measure before you replace anything

My first step in removing Jest was not removing Jest.

It was counting.

I built a census of the existing test corpus: every matcher, mocking API, timer operation, pragma and unusual feature. I used Jest's resolved configuration rather than assuming the configuration files accurately described what was happening.

The result shrank the job.

Across approximately 18,000 assertions, the actual surface area was surprisingly bounded: 28 matchers, 13 mock methods, eight asymmetric helpers and around 20 uses of `it.each`.

There were no snapshots.

There was no `expect.extend`.

The intimidating number was elsewhere: 115 files used `jest.mock`.

**The size of a migration is not the number of lines being migrated. It is the size of the behavioural surface you must preserve.**

Eleven thousand tests sounded enormous.

The vocabulary they actually spoke was about fifty words.

## Prototype the things most likely to kill the idea

Before committing to an architecture, I built six disposable experiments, with the assistance of an LLM.

One of them was particularly instructive.

I had a CommonJS loader that reproduced Jest's mock-hoisting behaviour beautifully. Existing test bodies could remain effectively untouched.

It worked.

...And I threw it away.

Node's coverage system could not honestly remap the resulting source positions. A file that was genuinely around 83% line coverage and 50% function coverage could be reported as 100%.

An ESM version of the same loader measured it correctly.

That established one of the most important rules of the entire migration:

**If you cannot measure a system honestly, it doesn't matter that it appears to work.**

Coverage had veto power over the architecture.

## Sometimes compatibility is cheaper than rewriting

Once I understood the surface area, I had two broad options.

I could rewrite thousands upon thousands of test expressions into native equivalents.

Or I could make the new environment understand enough of the old vocabulary.

I chose the second.

The resulting repository-local testing runtime is roughly 1,200 lines covering the functionality this repository actually uses: matchers, mocks, timers, loader hooks and coverage enforcement.

The important part is that I don't simply trust it.

The compatibility layer has its own suite of 455 tests running directly on `node:test` and `node:assert`.

In other words, **the shim is never tested using itself.**

Then each migrated project had to reproduce the test count from its Jest baseline and meet or exceed its previous coverage.

Writing your own infrastructure isn't automatically safer than installing somebody else's. Quite often it is considerably worse.

Ownership only becomes valuable when the thing you own is sufficiently small to understand and you are prepared to test it like a product.

## A green test run isn't enough

This migration made me substantially more suspicious of the colour green.

At one point, ESLint's `RuleTester` happily executed cases inline because it couldn't see a registered testing framework.

The tests passed.

But only 270 of 1,955 cases appeared in the test report.

At another point, Node's `--test-force-exit` caused tests to disappear nondeterministically. A run containing 580 tests became 569, then 568.

Again, what remained passed.

[Nx](https://nx.dev/) caching presented another version of the same illusion: a successful cached test task can be replayed without running the tests at all.

These failures led to a rule I now consider obvious in retrospect:

**The number of tests executed is itself an assertion.**

An exit code tells you that everything the runner believes it executed succeeded.

It does not prove that the runner executed everything you thought it did.

## `jest.mock` under native ESM was supposedly the impossible part

The biggest architectural concern was module mocking.

The conventional problem is straightforward: static ESM imports are linked before the module body executes. A `jest.mock()` expression appearing in that body therefore appears too late to replace one of those imports.

Jest solves this through transformation and hoisting.

I didn't want to rewrite 189 existing `jest.mock` calls if I could avoid it.

It turns out Node leaves a window.

Its module `load` hook sees the source of a test module before that module's imports are resolved. That means the loader can inspect the source, discover its mock declarations and register them before import linking occurs.

![One spec module moving through Node's four steps, load, resolve, link and evaluate. The load hook reads jest.mock('./api') out of the source at the load step, the resolve step swaps ./api for the mock, and link binds the mock, all before any line of the spec runs. The same jest.mock('./api') call only executes at evaluate, too late to replace an import.](/media/jest-article-mock-window/figure.webp)

So the existing `jest.mock` calls stayed.

Getting that basic idea working was not the hard part. Making it semantically trustworthy was.

Mocks needed to be substituted during resolution rather than loading. Registration could not itself load modules without accidentally binding real dependencies before their mocks existed. Query-string tricks created duplicate module identities and therefore duplicate coverage. TypeScript mock factories needed to survive intact.

Even `jest.requireActual` produced a particularly nasty recursive case because its own resolution passed through the hooks and found the mock it was supposed to bypass.

The broader lesson wasn't that everybody should implement Jest mocking with Node loaders.

It was this:

**Before accepting that the platform cannot do something, identify precisely which guarantee you actually require.**

I didn't need Jest.

I needed a particular set of semantics that Jest happened to provide.

Those are different statements.

## Coverage was harder than running the tests

The hardest part of the migration wasn't assertions or mocking.

It was coverage.

And most of the problems eventually reduced to identity.

Resetting modules could cause one source file to appear under multiple URLs. Node's LCOV reporter numbered anonymous functions in discovery order, so identical inputs could put one project's function coverage anywhere from 98.46% to 99.80%. It looked like nondeterminism. It was unstable names. Ignored regions could produce branch records whose interpretation differed from what the old tooling had taught us to expect.

Eventually I stopped trying to persuade those representations to behave like the previous system and owned the merge myself.

Raw LCOV records are merged per source file using stable identities such as declaration lines and branch indexes, and the resulting representation is what the repository gates against.

Once the merge became deterministic, something surprising happened.

Much of what looked like "V8 has worse coverage than Istanbul" disappeared.

The deficit wasn't in the tests.

It was in my measurement.

Some thresholds I had temporarily lowered could be raised again.

That gave me another rule:

**Interrogate a measurement deficit before institutionalising it.**

Lowering a threshold is easy.

Proving that the lower number represents reality is harder.

## The migration deleted more than dependencies

One of the most satisfying discoveries was how much configuration had simply fossilised.

In one group of projects I found 77 Istanbul coverage pragmas.

Only 12 were actually necessary under V8 coverage.

The right migration strategy wasn't translating all 77 pragmas from Istanbul syntax into Node syntax.

It was deleting all 77 and adding back the 12 that could prove they still had a job.

The same went for `ts-node`, which turned out to be installed only so that Jest could read its own configuration file.

Old configuration accumulates because deleting something requires confidence while leaving it alone requires nothing.

## Native tooling has sharp edges too

None of this convinced me that `node:test` is magically better.

I found plenty of sharp edges.

`it.todo` behaves differently from Jest. Test context can leak into child processes through environment variables. Fake timers don't drain recursively in exactly the same way. Sub-millisecond delays can produce pathological behaviour if handled incorrectly. Type stripping changes some assumptions that tests previously inherited from TypeScript compilation. Decorators and parameter properties required special consideration.

DOM setup also exposed cross-realm problems around globals, `instanceof`, timers, `crypto`, `URL`, `EventTarget` and `window`.

This matters because "use the platform" can become just as lazy a slogan as "don't reinvent the wheel."

Native does not necessarily mean complete.

It simply means the baseline capability has moved, and you must still determine if that baseline is sufficient for your specific problem.

For this repository, it wasn't, at least not without significant elbow grease. Its packages ship in both ESM and CommonJS, and the tests had to hold under both.

## The most valuable result was finding bugs that already existed

Something else happened when the new runner started executing the same tests through a different set of assumptions.

It found product bugs.

A `close()` operation in one HyperFrontend feature left heartbeat and visibility reporters alive because of a teardown race. Jest's worker termination had concealed the defect.

The published ESM builds of two other packages carried three distinct bundling defects. Native ESM refused to load them.

More remarkably, the Jest-era suites explicitly claiming to test the ESM format had been green.

The problem was that `ts-jest` had transformed `await import()` through CommonJS interoperability.

The suites said "ESM."

The runtime underneath them was CommonJS.

Three defects, all green, all lying.

![An ESM suite calls await import('pkg'), but its path runs through ts-jest to the package's "require" export, index.cjs.js, which passes. A dashed line toward the "import" export, index.esm.js, stops short of it. Only an ESM consumer's import reaches index.esm.js, which fails.](/media/jest-article-esm-doors/figure.webp)

This is where even my test-count rule reaches its limit.

A matching count catches tests that silently vanish. It cannot show that the tests that ran meant the same thing, not once the runtime underneath them has changed.

That was probably the most valuable lesson of the migration:

**Abstractions don't only provide capabilities. They also determine what you are capable of seeing.**

Jest had made testing easier.

In a few places, it had also made the underlying platform less visible.

## A migration is an audit

This whole effort changed how I think about large infrastructure migrations.

We tend to frame them as replacement projects: old thing out, new thing in, preserve behaviour, minimise churn.

But a sufficiently fundamental migration is also an audit. Every test is executed again under slightly different assumptions. Every piece of configuration has to explain itself. Every ignored line, environment setup, mock, timer and module boundary gets another opportunity to fail.

The migration itself can be expensive. The audit rides along almost free, because you are already paying to run everything again. The mistake is budgeting only for the migration and treating what it finds as scope creep, when the findings were a large part of what you bought.

## You have to write down what gets worse

There is a temptation when an experiment succeeds to rewrite its history as an obvious victory.

This one had costs.

I gave up Jest's HTML coverage reporter. The `statements` coverage metric disappeared into lines. Some lint coverage previously supplied by `eslint-plugin-jest` went away. Hook timeouts needed new syntax, and spying on an ESM namespace export stopped working altogether.

I also acquired approximately 1,200 lines of infrastructure that are now my responsibility. That responsibility has since grown: the shim is published as [@hyperfrontend/testing](/docs/libraries/testing), so code I wrote for one repository now carries a public API, semantic versioning and other people's test suites.

Those costs were recorded when the decisions were made rather than rationalised afterward, and I think that practice matters.

**A trade-off you write down before making a decision is a trade-off. A trade-off you discover afterward is a surprise.**

## So was removing Jest worth it?

For this repository, yes, and I would make the same exchange again.

The final root lockfile went from 1,321 packages to 864. That's 457 packages gone.

It isn't 457 fewer risks. Most of what left was well maintained, and its replacement has exactly one maintainer. What changed is whom I am trusting: far fewer strangers, and a lot more of myself.

Root `devDependencies` went from 44 to 36. Jest, `ts-jest` and `@nx/jest` disappeared. The libraries run through `node:test`, coverage remained at or above the previous baselines, test bodies remained overwhelmingly unchanged, and the migration surfaced product defects the old setup had certified as passing.

None of which means you should remove Jest. That would turn an argument against casual dependency decisions into another casual dependency decision.

## We should reconsider what code reuse means

The JavaScript ecosystem gave us an extraordinary amount of infrastructure during a period when the platform itself couldn't provide it. We should be grateful for that work, but gratitude doesn't require permanent dependency. As capabilities move into Node and browsers, it is worth periodically asking which abstractions are still earning their place.

AI makes that question more pressing. If implementing 100 or 1,000 lines of highly specific infrastructure keeps getting cheaper while the cost of trusting enormous dependency graphs stays where it is, the equilibrium moves.

Sometimes installing the package will still be overwhelmingly correct. Sometimes owning the code will be reckless. And sometimes 1,200 lines that you completely understand are a better engineering proposition than hundreds of packages that you don't.

Package managers made reuse almost frictionless, which was transformative for JavaScript. I would like them to make its cost as visible. npm could show dependency depth and transitive package counts up front. Projects could set dependency budgets, and installation policy could stop a package that exceeds them, the way pnpm already refuses to run dependencies' install scripts unless you allow them.

Imagine seeing this before `npm install`:

> _This package adds 4 direct dependencies, 73 transitive dependencies, 9 maintainers and a maximum dependency depth of 7._

Then imagine being able to say:

> _This repository does not accept a new dependency graph deeper than 4 without explicit approval._

Neither number measures trustworthiness. Seven layers of well-run packages can be safer than one abandoned package with no dependencies at all. What the numbers measure is how much trust an install is asking for, which is precisely the part an install hides today. They are prompts for a decision, not the decision.

Replacing Jest didn't teach me that dependencies are bad.

It taught me that **ownership and reuse are both costs, and the price of each has changed.**

We should start recalculating.

- Do you want to see the actual code changes? [PR #153](https://github.com/AndrewRedican/hyperfrontend/pull/153)
- On the same journey? See the [de-jest skill](https://github.com/AndrewRedican/hyperfrontend/tree/main/.claude/skills/de-jest)

_Update, October 2026: [How to migrate a Jest suite to Node's test runner](/docs/guides/migrate-from-jest-to-node-test) is the practical companion to this piece, built on the published [@hyperfrontend/testing](/docs/libraries/testing)._
