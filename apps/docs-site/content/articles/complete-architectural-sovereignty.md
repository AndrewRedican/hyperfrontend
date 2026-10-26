---
title: 'Complete Architectural Sovereignty'
description: "An argument for owning more of your software, knowing when not to, and reconsidering some of the assumptions we've inherited from modern dependency culture."
date: '2026-10-26'
author: 'Andrew Redican'
readingTime: '17 min read'
heroImage: '/articles/complete-architectural-sovereignty/hero.webp'
category: 'field-notes'
tags: 'dependencies, architecture, supply chain, open source, ai-assisted engineering, tooling, testing, linting'
packages: '@hyperfrontend/testing, @hyperfrontend/linter, @hyperfrontend/builder, @hyperfrontend/features'
related: 'i-replaced-jest-with-1200-lines-of-code, i-replaced-eslint-the-first-attempt-worked-i-threw-it-away'
---

**Why I started questioning the way we build software**

_An argument for owning more of your software, knowing when not to, and reconsidering some of the assumptions we've inherited from modern dependency culture._

![A man faces a glass tower at sunset and studies his own reflection, while the skyline behind it carries the names webpack, rollup, jest, nx, typescript and eslint beside the title Architectural Sovereignty](/articles/complete-architectural-sovereignty/hero.webp)

A few days ago, I asked an AI to examine the structure of an open-source repository I've been building.

I wasn't asking whether the software worked, whether it solved a useful problem, or whether the documentation was any good. I wanted an assessment of how the code was organised.

The response was unexpectedly flattering, although AI isn't exactly known for being difficult to impress.

It described the architecture as a "textbook example of hyper-granular, zero-dependency monorepo design". It praised the strict boundaries, layered structure, and consistency of the implementation.

Then came the verdict:

[**Beautifully over-engineered.**](https://share.google/aimode/hWKJlnrtDRgkDphpN)

I won't pretend I didn't enjoy reading that. But the more I thought about it, the less interested I became in the assessment itself, and the more curious I grew about the decisions that had led me there.

The repository contains [21 independently published packages](/docs/libraries), ranging from small utilities to a microfrontend runtime, testing infrastructure, a linter, and library-building tools.

Much of that code exists because, at some point, I decided I would rather implement something myself than continue relying on an existing dependency.

To some developers, that probably sounds exhausting. To others, perhaps irresponsible.

And I can understand why.

Modern JavaScript development has spent years teaching us to avoid reinventing the wheel. There's an established package for almost everything, and an enormous ecosystem of developers who have already encountered problems we haven't.

_Why throw away all that accumulated work?_

It's a reasonable question. But the review introduced a phrase I hadn't previously used to describe what I was doing.

**Complete architectural sovereignty.**

I liked it. Not because I'm attempting to eliminate every dependency. I'm not, and I doubt that would be particularly sensible.

I liked it because it gave a name to something I'd been doing almost instinctively, and an opportunity to examine the assumptions behind it.

_What does it actually mean to own your architecture? And perhaps more importantly, when did we become so comfortable allowing other people's abstractions to determine its shape?_

## The sensible thing to do

Imagine you're building an application.

You encounter a problem that someone else has almost certainly solved before. Perhaps you need to validate some data, transform a file, manage application state, or handle a particular testing requirement.

You search npm.

You find a package with millions of downloads, an active maintainer, comprehensive documentation, and a healthy release history.

You install it.

Problem solved.

This is an entirely reasonable way to develop software. It might even be the best decision.

But notice how little architectural investigation was necessarily required. You identified a problem, found a solution that addressed it, and incorporated that solution into your system.

The existence of a mature package effectively settled the question of whether you should implement the functionality yourself.

And for much of JavaScript's history, that instinct was well justified.

The language and its surrounding platforms were not always particularly capable. Browsers disagreed about important behaviours. Standard APIs were missing. Developers needed compatibility layers, module systems, build tools, testing infrastructure, and countless utilities to make ordinary application development practical.

Open source filled those gaps.

An extraordinary amount of work became available to everyone, often maintained by people who received very little in return. That ecosystem is one of JavaScript's greatest achievements.

But successful conventions have a peculiar tendency to survive the circumstances that originally justified them.

Eventually, we stop asking why we do something. We simply recognise it as good practice.

And that is where I think we've arrived with certain aspects of dependency management.

**We've become exceptionally good at evaluating which dependency to use, but perhaps less inclined to question whether we need one at all.**

I don't think that makes developers careless. In many cases, the constraints that made dependency reuse sensible are still present.

But constraints change, and the decisions built around them deserve another look.

## Reuse is not free

Consider what happens when you install a general-purpose package.

You're acquiring functionality, certainly. But you're also acquiring a collection of decisions made by people solving a problem that is not quite yours.

They've chosen abstractions, interfaces, configuration models, supported environments, compatibility guarantees, and behaviours intended to accommodate their consumers.

Those decisions may be excellent. They might represent years of hard-earned knowledge.

But they're still decisions made for a different set of requirements.

Suppose a package solves ten variations of a problem, and your application only needs one. The implementation might devote most of its complexity to supporting the other nine.

That doesn't automatically mean the package is poorly designed. Quite the opposite: supporting those variations might be precisely what makes it valuable to its community.

But your software still has to accommodate its abstraction.

Sometimes that's trivial. Other times, you introduce adapters, configuration, compatibility layers, and workarounds just to persuade a general-purpose solution to behave in the particular way your application requires.

Now repeat that process across an entire dependency graph.

Each package solves its own problem, has its own priorities, and evolves according to the needs and judgement of its maintainers.

And somewhere in the middle sits your application, attempting to coordinate everything into one coherent system.

There's a subtle contradiction here.

We reuse abstractions to reduce complexity, yet the composition of independently designed abstractions can introduce complexity of its own.

Not necessarily more complexity.

Just a different kind.

> **Reuse doesn't eliminate complexity. It changes where the complexity lives, who controls it, and who is responsible when something goes wrong.**

There's also a security dimension.

External dependencies introduce code into your build and execution environments that you didn't author. Transitive dependencies extend that trust to packages you may never have selected directly.

This isn't a hypothetical concern. In September 2025, CISA reported that the Shai-Hulud npm supply-chain attack had compromised more than 500 packages, with malicious code targeting developer credentials and propagating through compromised accounts. ([CISA advisory](https://content.govdelivery.com/accounts/USDHSCISA/bulletins/3f408db))

That doesn't mean installing dependencies is inherently unsafe, nor does writing your own implementation guarantee security.

But dependencies are trust relationships, and trust relationships deserve deliberate consideration.

The cost of a package isn't merely its installation size, runtime overhead, or maintenance burden.

It's also the set of external decisions your software now depends upon.

## What I mean by sovereignty

Taken literally, complete architectural sovereignty is an absurd proposition.

To be entirely independent, I would have to implement my own runtime. Then perhaps my own operating system.

Eventually, with enough time and questionable judgement, I might find myself manufacturing computer chips and reconsidering whether I should invent my own mathematics.

That sounds exhausting, even to me.

Every implementation depends on something.

The question is not how to eliminate every dependency.

The question is **where to draw the boundary between what you own and what you trust someone else to provide.**

In my case, I'm comfortable depending on Node.js. I'm comfortable depending on TypeScript.

And, as I recently rediscovered, I'm quite comfortable depending on Rollup.

These aren't arbitrary exceptions to an otherwise strict philosophy. They're examples of different engineering responsibilities that I have good reasons to delegate.

I look at the problem a dependency solves, the maturity of its implementation, the stability of its underlying requirements, and the amount of responsibility I would inherit by replacing it.

Sometimes I can implement precisely what I need with relatively little code. Sometimes the platform already provides most of the functionality, and the dependency has become little more than an abstraction around it.

And sometimes the existing solution represents years of accumulated engineering knowledge that would be extraordinarily expensive to reproduce.

I've encountered all three situations recently.

![A Swiss Army knife with every blade unfolded, a wooden hand plane resting in fresh shavings and a circular saw lie side by side on a sunlit workbench](/articles/complete-architectural-sovereignty/workshop-tools.webp)

## The platform caught up

For years, Jest was a natural choice for testing JavaScript.

It offered a comprehensive testing environment, assertions, mocking, execution infrastructure, configuration, coverage, and a familiar developer experience.

I used it extensively.

But eventually I started questioning how much of it I actually needed.

Node.js had developed its own testing infrastructure. It could discover and execute tests, provide assertions, support mocking, and collect coverage.

Functionality that previously justified an extensive external toolchain was increasingly available directly from the runtime. ([Node.js test runner](https://nodejs.org/api/test.html))

So I investigated.

_What would it take to preserve the parts of Jest I actually used while delegating test execution to Node?_

The result became [`@hyperfrontend/testing`](/docs/libraries/testing).

It retained familiar interfaces while replacing much of the existing implementation with a relatively small compatibility layer built around Node's native capabilities.

I wasn't attempting to create a better Jest for everyone, or trying to match its entire feature set. I was identifying the capabilities my repository needed and implementing the smallest practical layer that preserved the developer experience I wanted.

The outcome was useful enough that I eventually published it.

But here's what I find most interesting about that experience.

**I hadn't replaced a mature testing ecosystem with an entirely new one. I'd recognised that part of the ecosystem's historical responsibility had moved into the platform itself.**

For a large application with extensive integrations, custom transformations, or a substantial existing test suite, migration could cost considerably more than it saves.

For my repository, however, the relationship between what Node provided and what I actually needed had changed enough to justify a different approach.

## The difficult one

[Replacing my linting infrastructure](/articles/i-replaced-eslint-the-first-attempt-worked-i-threw-it-away) was a different experience.

Unlike testing, there wasn't an equivalent set of mature Node APIs waiting underneath the existing abstraction. I had to assume considerably more responsibility.

Parsing, rule execution, configuration, diagnostics, formatting, and the interactions between those components all required serious consideration.

And that exposed an important difference between understanding how to use a tool and understanding the problem it solves.

I'd spent years writing custom lint rules. I'd examined their implementations, explored the underlying interfaces, and developed a reasonable understanding of how the system worked.

That experience put me in a position to make an informed judgement about what I needed.

But it didn't make the problem easy.

I investigated the existing architecture, identified the behaviours my workspace depended upon, and gradually worked towards an implementation tailored to those requirements.

Much of the difficulty involved understanding what could safely be excluded.

Because a general-purpose linter faces a very different problem from one designed around a constrained codebase.

The general-purpose implementation must accommodate countless projects, configurations, plugins, languages, and usage patterns.

My implementation doesn't have to solve all those problems. It only needs to solve the ones I've deliberately agreed to support.

That's an enormous difference in scope.

It also introduces a different kind of risk.

An established tool benefits from a vast population of users discovering unusual failures. My implementation doesn't have that distributed feedback mechanism.

A subtle parsing defect might go unnoticed until my code exercises the particular behaviour that triggers it.

I can't pretend that risk disappears because I wrote the implementation myself.

Instead, I rely on a combination of tests, behavioural comparisons, constrained requirements, and the freedom to control when my workspace adopts new language features.

The last point deserves attention.

> **Supporting an evolving ecosystem and consuming an evolving ecosystem are different responsibilities.**

A general-purpose tool must continually accommodate changes introduced by others. My workspace can decide when those changes become relevant.

I can postpone adopting new syntax until I have a reason to use it and the necessary support is in place.

That flexibility makes a narrower implementation practical, but it also depends on remaining disciplined about its scope.

And that discipline was about to be tested.

## Eight hours I'll gladly lose again

After replacing my testing and linting infrastructure, I turned my attention to Rollup.

My reasoning seemed consistent. If I could replace those substantial dependencies with implementations tailored to my workspace, perhaps I could do the same with my [library builder](/docs/libraries/builder).

I had a clear objective.

I didn't need a general-purpose bundler for every conceivable project. I needed something that could build my own libraries into the formats I supported.

_How difficult could that be?_

As it turns out, considerably more difficult than I'd anticipated.

I began investigating the implementation with AI assistance. The deeper I went, the more I encountered nuances that weren't immediately obvious from the outside.

First, module resolution. Then CommonJS interoperability. Then import and export semantics, output transformations, and tree-shaking.

No single problem seemed insurmountable. The trouble was what happened between them.

A resolution decision affected interoperability. A transformation could change which imports retained their meaning. Tree-shaking had to preserve side effects across all of it. ([Rollup FAQ](https://rollupjs.org/faqs/))

What looked like a list of features was really a web of interacting constraints, and together they represented a much larger responsibility than I initially appreciated.

Then something clicked.

I could probably continue. Given enough time, investigation, and iteration, I might eventually produce something useful.

But why?

_What exactly would I gain? More importantly, what would I now be responsible for maintaining?_

This wasn't a relatively stable collection of behaviours that I could comfortably constrain to my own requirements.

It was a substantial body of infrastructure whose correctness depended on language semantics and compatibility expectations that would continue evolving outside my control.

I'd be assuming an obligation that could easily distract me from the problem I actually wanted to solve.

So after roughly eight hours of investigation, I abandoned the attempt.

I kept Rollup.

And I consider that decision every bit as successful as replacing Jest or my linter.

Perhaps more successful.

The experiment hadn't produced a bundler, but it had given me a much clearer appreciation of what maintaining one actually involved.

Eight hours was a reasonable price to pay for that understanding.

## The danger of beautiful engineering

There's another uncomfortable aspect to all this.

Sometimes I build things because I find them intellectually interesting.

I enjoy understanding complex systems. I'm drawn to problems that require considerable investigation, experimentation, and reasoning from first principles.

And there's genuine satisfaction in building something sophisticated that works.

But sophistication is not evidence of good engineering.

I've learned that repeatedly.

Earlier in my career, I occasionally designed elaborate abstractions that concentrated an enormous amount of complexity behind a seemingly elegant interface.

I could explain them. I could defend them. Sometimes I could even convince other engineers that they represented a superior solution.

Then someone would approach the same problem from a different direction and solve it with twenty lines of code.

Or we'd discover, months later, that an architectural decision I'd defended passionately had introduced more problems than it solved.

Those experiences are uncomfortable, particularly when you've persuaded other people to follow your judgement.

But they teach something that technical knowledge alone doesn't.

**Being capable of implementing a sophisticated solution doesn't establish that the sophistication is necessary.**

This is particularly relevant when you're pursuing architectural ownership.

Because once you decide to build something yourself, it's remarkably easy to mistake the intellectual satisfaction of the exercise for evidence of its practical value.

You need to distinguish between three outcomes:

- The implementation improves your software.
- The exercise improves your understanding.
- The exercise is enjoyable.

Sometimes all three are true.

Sometimes only one is.

There's nothing wrong with writing code purely to learn something. But learning exercises shouldn't automatically become production infrastructure.

That distinction requires judgement.

And judgement, unfortunately, is something you tend to develop by being wrong.

## Why I keep splitting things apart

The original review raised another criticism.

[Hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) contains 21 independently published packages. Some are quite small, with utilities dedicated to strings, functions, lists, time, and other relatively narrow concerns.

_Why so much fragmentation? Why not combine everything into a handful of larger libraries?_

It's a fair criticism.

Package boundaries introduce structural complexity. They require interfaces, dependency relationships, versioning decisions, and sometimes compatibility considerations that wouldn't exist if everything lived inside one module.

But they also allow me to trade one form of complexity for another.

What I care about particularly is behavioural consistency.

Suppose five parts of a codebase need to perform the same operation. If each implements the operation independently, there are now five opportunities for subtle differences to emerge.

Different edge cases, different error handling, different assumptions.

Different bugs.

Those differences might remain harmless for years. Then someone changes one implementation without realising that four others exist.

By creating canonical implementations and enforcing their use, I reduce that variation.

I introduce more explicit boundaries, but fewer independent interpretations of the same responsibility.

That is the trade I'm making.

**Structural simplicity and behavioural simplicity are not necessarily the same thing.**

Of course, this doesn't mean every reusable function deserves its own package.

The important distinction is whether the boundary provides enough value to justify the responsibilities it introduces.

In my case, the surrounding workspace infrastructure automates much of the repetitive work. And because I already develop and consume these libraries internally, publishing them requires relatively little additional effort.

Publication also creates an interesting incentive.

When something is intended for external consumption, I'm more likely to insist on complete documentation, examples, explicit contracts, and thorough verification.

The standards rise. The software becomes easier to understand, even for me.

And occasionally someone else finds it useful.

I don't need every package to become popular.

The flagship product is the [microfrontend runtime](/docs/libraries/features). [The supporting libraries exist because I needed them to build it.](/articles/hyperfrontend-the-long-way-around#why-there-are-so-many-packages)

Making those implementations available to others is a relatively straightforward extension of work I was already doing.

But publication introduces expectations of its own, something I'd encountered long before starting Hyperfrontend.

## Ownership is not an obligation to everyone

Years before Hyperfrontend, I published a [React JSON editor](https://github.com/AndrewRedican/react-json-editor-ajrm).

It was a relatively small project. I built it because I needed it, then made the source available.

Over time, it became unexpectedly popular. Eight years later, people were still interested in it.

And with that popularity came expectations.

Feature requests. Maintenance requests. Pressure to improve something I no longer had the time or inclination to develop.

That experience changed how I think about publishing open-source software.

A maintainer can make something useful available without implicitly promising to devote the rest of their career to it.

The MIT licence is quite explicit about the absence of warranties. People are free to use the software, modify it, fork it, or build on top of it.

And maintainers are equally free to say no to changes that don't align with the direction they want to pursue.

A library doesn't need to become a universal solution merely because people find it useful.

In fact, attempting to satisfy everyone can gradually undermine the qualities that made the original implementation valuable.

Every new feature introduces another responsibility. Every compatibility promise constrains future decisions. Every supported variation expands the problem space.

And eventually, the carefully scoped implementation you originally built starts resembling the general-purpose dependency you wanted to avoid.

For a commercial product, a contractual relationship, or a library maintained by an organisation, the balance may be very different.

But for an independent maintainer, defining the scope of what you're willing to support is as important as defining the scope of what you're willing to build.

## AI changes the equation, but not the mathematics

There's an obvious reason why some of these decisions have become more practical for me.

AI.

I don't think it makes sense to discuss the economics of writing software in 2026 without acknowledging how substantially AI-assisted development has changed parts of the process.

Tasks that once required prolonged implementation effort can now be explored much faster. Existing codebases can be investigated, alternative designs prototyped, and tests generated and refined.

Large-scale transformations can be attempted without manually editing every affected file.

For a small project, or a project maintained by one person, these capabilities can be transformative.

But there's a distinction that gets lost in some of the excitement.

**Reducing the cost of producing code doesn't necessarily reduce the cost of being responsible for it.**

An LLM can generate an implementation. It cannot guarantee that the implementation is correct merely by producing it.

It can write tests, but those tests might encode the same mistaken assumptions as the implementation.

It can review architecture, and its conclusions can be persuasive and still be wrong.

And because the resulting code often looks plausible, the developer needs to remain actively involved in deciding what deserves trust.

This is why automated verification has become so important to how I work.

I have tests at the package level, integration tests, and [end-to-end tests that exercise packages as external consumers would](/docs/guides/test-a-package-the-way-a-consumer-installs-it), including whether their published module formats behave correctly.

I maintain [linting rules that enforce consistent architectural constraints](/docs/regarding-ai#steering-output-toward-project-standards), and I use external security analysis to provide scrutiny beyond the systems I've built myself.

None of those measures makes the code infallible. Nor does extensive testing substitute for independent security review, particularly when cryptographic protocols or other security-sensitive components are involved.

But they make it practical to assume responsibility for a larger body of implementation than I would previously have considered reasonable.

There's an economic change here.

The cost of implementation has fallen. The cost of verification has also changed, although not always proportionally.

But the underlying mathematics remains: every implementation still carries some chance of failure, a cost when it fails, and a maintenance obligation that outlives the moment it was written.

And the cost of maintaining a deliberately constrained implementation can be substantially different from maintaining a general-purpose one.

**A decision that was economically irrational five years ago may be perfectly reasonable today.**

The difficulty is recognising which decisions have genuinely become more affordable, rather than merely easier to attempt.

My abandoned Rollup experiment is a useful reminder of the difference.

## Knowing what you don't know

There's one more advantage to implementing something yourself that doesn't appear in dependency graphs or benchmark results.

Understanding.

While developing Hyperfrontend's [communication mechanisms](https://www.hyperfrontend.dev/architecture/#communication-layer-nexus), I spent considerable time reasoning about how two independent applications should establish and maintain a trustworthy communication channel.

I needed to think about connection establishment, acknowledgements, retries, timeouts, and what happens when one participant disappears.

Eventually, I arrived at a three-way handshake.

I was rather pleased with it.

I showed the design to a colleague.

He looked at it and asked:

"Like TCP?"

I hadn't made the connection.

In fact, I knew embarrassingly little about TCP's handshake at the time.

I'd independently arrived at a familiar networking pattern because the underlying problem naturally encouraged a similar solution.

That experience was instructive.

Not because I'd invented something new. I hadn't.

And certainly not because independently rediscovering an established design guarantees that you've understood every subtlety accumulated through decades of real-world use.

It doesn't.

The interesting part was how I arrived there.

I had a concrete problem. I worked through its constraints. I made assumptions, challenged them, and revised the implementation.

And through that process, I developed an understanding that simply importing a communication library wouldn't necessarily have required.

This is one reason I'm reluctant to dismiss reinvention as inherently wasteful.

The implementation might eventually be replaced, but the understanding acquired while producing it can remain useful long afterwards.

Of course, not everyone wants to spend their time exploring protocol design, compiler architecture, or the internals of testing infrastructure.

Nor should they have to.

There are perfectly valid reasons to remain focused on application development and delegate those concerns to specialists.

But for engineers who enjoy understanding systems deeply, the opportunity to investigate how things work can be valuable in its own right.

The TCP experience also revealed something less flattering: I had worked my way towards a familiar solution without recognising the existing body of knowledge surrounding it.

That was worth discovering too.

## A different frame of reference

I've been thinking recently about how our experiences shape what we consider normal.

Take travelling.

You visit another country and discover people doing familiar things in unfamiliar ways.

Different food. Different customs. Different expectations about what constitutes politeness, efficiency, or a good way to live.

Some of those differences are delightful. Others are inconvenient.

You might come home convinced that certain things work better elsewhere. Or you might return with a greater appreciation for things you previously took for granted.

Either way, you've acquired something useful.

A different frame of reference.

You can now evaluate familiar experiences against alternatives you previously knew only in theory.

![Two people stand on either side of a faceted marble sculpture suspended above a concrete block in a white gallery, each looking up at it from their own position](/articles/complete-architectural-sovereignty/frames-of-reference.webp)

I think software engineering works similarly.

Our convictions are shaped by the systems we've built, the failures we've encountered, the people we've learned from, and the conventions surrounding us.

Someone who has spent a decade maintaining large enterprise applications might reasonably approach architecture very differently from someone building a specialised system independently.

A developer who has experienced the consequences of maintaining custom infrastructure may have excellent reasons to avoid it.

Someone who has spent years negotiating workarounds around external dependencies may have equally good reasons to prefer ownership.

Both perspectives can be valid.

And both can become limiting when treated as universal truths.

That's where I think our industry occasionally gets into trouble.

We take lessons learned under particular constraints and elevate them into principles that appear to apply everywhere.

Don't reinvent the wheel.

Always reuse existing solutions.

Prefer established libraries.

Avoid unnecessary abstraction.

Keep things simple.

These are useful heuristics.

They aren't laws of nature.

And sometimes they contradict each other.

A reusable abstraction might increase complexity. A custom implementation might be simpler than an established dependency.

An apparently over-engineered architecture might make a particular class of future changes much easier.

Or it might just be over-engineered.

The difference is rarely visible from the architecture alone. It becomes clearer when you understand the requirements, the history behind the decisions, and the constraints under which they were made.

## The right to make a different choice

The original review called the repository _beautifully over-engineered_.

I still like that description, although I suspect the word _beautifully_ is doing quite a lot of work.

Looking back at the decisions behind those 21 packages, I can see examples of very different outcomes.

[Replacing Jest](/articles/i-replaced-jest-with-1200-lines-of-code) was largely about recognising how much the platform had evolved. [Building a linter](/docs/libraries/linter) was about accepting a narrower problem in exchange for greater responsibility. Keeping Rollup was about discovering just how much responsibility I didn't need to assume.

And some of the smaller libraries exist because I simply wanted to understand and implement something for myself.

I wouldn't want another developer to read this article and conclude that they ought to recreate their testing framework, implement their own linter, or divide their project into twenty-one packages.

That would be a rather unfortunate outcome.

I'd prefer something considerably smaller.

The next time they encounter a problem and instinctively reach for an npm package, perhaps they'll examine what the platform already provides, what the dependency actually does, and what it would cost to implement the functionality themselves.

They might still install the package.

They might write twenty lines of code instead.

Either way, they'll have learned something about the problem before committing to a solution.

For me, that's the most useful consequence of questioning an established practice. Not necessarily changing the decision, but understanding it well enough to know when a different one makes sense.

That's what architectural sovereignty means to me.

Not independence from everyone else's work.

**The freedom to decide, deliberately, which parts of it become your own.**
