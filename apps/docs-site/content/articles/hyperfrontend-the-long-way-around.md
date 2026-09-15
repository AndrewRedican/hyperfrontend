---
title: 'Hyperfrontend: The Long Way Around'
description: 'The code is nine months old. The ideas behind it took ten years, and every package exists because something else needed it first.'
date: '2026-09-15'
author: 'Andrew Redican'
readingTime: '26 min read'
heroImage: '/media/long-way-three-clocks/figure.light.webp'
category: 'retrospective'
tags: 'architecture, microfrontends, iframes, open source, ai-assisted engineering, tooling'
packages: '@hyperfrontend/features, @hyperfrontend/nexus, @hyperfrontend/cryptography, @hyperfrontend/project-scope, @hyperfrontend/builder, @hyperfrontend/versioning, @hyperfrontend/immutable-api-utils'
related: 'microfrontends-from-first-principles, hyperfrontend-vs-module-federation'
---

_The code is nine months old. The ideas behind it took ten years, and every package exists because something else needed it first._

Hyperfrontend took about nine months to build.

Depending on how you count, it also took about five years.

Or perhaps ten.

The code that exists today is relatively new. The ideas behind it are not. They came from years of building software, inheriting software, watching organizations struggle to make software together, seeing good architectural ideas implemented badly, and occasionally rediscovering concepts that computer science had already named decades before I encountered them.

I didn't sit down one morning with a diagram and decide to create nineteen packages.

Most of them exist because, somewhere along the way, I needed something.

Then that thing needed something.

And eventually all those paths began converging on the same idea.

![Three timescales converging on Hyperfrontend: about ten years of engineering, about five years of returning to the runtime-composition problem, and about nine months of implementation in 2026](/media/long-way-three-clocks/figure.webp)

## Before any of this

I started coding around 2015 or 2016.

Calling it "coding" might be generous at first. I was working in a call center business, cobbling together Excel formulas, learning Visual Basic and spending a lot of time on Stack Overflow.

One role led to another. Eventually I became a software quality analyst, did reasonably well at it, and then became a software engineer.

Around 2018, I had already decided that I wanted to move to Ireland. My wife and I saved enough money to make it possible, but there wasn't much of a safety net waiting for me there. I also knew that arriving in another country and saying _I can write software_ wasn't particularly compelling evidence that I actually could.

So I built something.

It was a slightly ridiculous React component that looked something like Visual Studio: an editable multiline area with syntax highlighting and some other features.

At the time I was working heavily with Firebase and JSON, and I had become dissatisfied with what happened when JSON was malformed. `JSON.parse` could tell me something was wrong, but I wanted something capable of reasoning about _where_ the problem probably was and potentially repairing it.

So I developed an algorithm that worked inward from the left and right sides of a would-be JSON document, trying to determine the most likely point of failure.

Don't ask me exactly how I arrived there.

I was learning.

The whole thing was JavaScript and a little over a thousand lines of code. I worked ridiculously hard on it, documented it reasonably well, published it as open source, and was proud of it.

Then life happened.

I found work. Other things became more important. The project sat there.

At some point much later, I looked at the download statistics.

It was doing roughly half a million downloads a month.

That was an extraordinary feeling. Something I had built because I needed evidence that I could write software had somehow escaped into the world and was being used at a scale I had never planned for.

It also taught me my first uncomfortable lesson about open source.

People wanted things.

Lots of things.

They mostly wanted me to build those things.

I eventually collaborated with another developer and got my first real experience maintaining something with somebody else, but eventually I reached the point where I didn't want to work on it anymore.

I archived it.

And somewhere in my head I made a promise:

_Next time I'll do it properly._

TypeScript. Better architecture. Better engineering.

Whatever "properly" meant.

For years afterward I periodically returned to the JSON problem. Trying to repair JSON more intelligently led me into trees, data structures, arithmetic tricks, bitwise operations, Web Workers and performance work. Sometimes I was learning established computer-science concepts without initially knowing their names.

Nothing substantial came from those iterations.

But that pattern would become important later.

I have repeatedly found myself trying to solve a concrete problem from first principles and eventually discovering that computer science already has a name for the thing I arrived at.

That happened again with Hyperfrontend.

## Dell, and my first real encounter with microfrontends

Dell EMC was important for a different reason.

It was one of the places where I learned what good software engineering could look like.

I was working full stack: Kotlin, Java, Spring Boot and Angular. It was a greenfield environment with engineering practices that, at the time, felt almost magical. You could make a change, raise a pull request and have a well-engineered path all the way into production.

I made friends there whom I still speak to today.

It was also where I first encountered microfrontends.

I watched substantial engineering groups try to make independently evolving frontend systems meet. At the time I didn't even have particularly precise language for the different kinds of microfrontend architectures.

What I did understand was the coordination problem.

Different teams carried different assumptions about frameworks, versions, shared dependencies, release timing and ownership. The technical strategy itself was defensible. Operating it across organizational boundaries was much harder.

That experience became foundational to how I think about architecture.

You can choose a perfectly defensible strategy and implement it badly.

You can also implement a strategy correctly and discover that it asks an organization to coordinate in ways the organization is not particularly good at coordinating.

Those are different failures.

Dell was the first place where I really understood that the technical shape of an architecture and the organizational system expected to operate it are inseparable.

My next job showed me the problem from almost the opposite direction.

## Software archaeology

After Dell I followed a former teammate to a much smaller SaaS company.

The difference was enormous.

At Dell I had seen greenfield engineering and mature delivery practices. Here, working on almost any feature felt like archaeology.

Something that looked like a day or two of work on paper could turn into three or four weeks.

The product had accumulated roughly a decade of software, with different generations of engineering decisions sitting on top of one another like geological strata.

You could almost read the history of the system in the source code.

_This layer came first._

_This one came later._

_Someone else solved the same problem a different way._

_Nothing ever quite replaced everything that came before it._

The product itself clearly had value. It solved real problems for real customers. But technically, many different eras of the system had to coexist.

Because much of the product lived inside or alongside a larger CRM ecosystem, we had to compose an extraordinary variety of web experiences at runtime: editors, media and asset management, campaign interfaces, forms and other embedded applications.

That meant I learned a lot about composing websites at runtime.

I saw iframe approaches. Server-rendered views. .NET. Context objects passed between systems. Different technology stacks. Different communication mechanisms. Different attempts at solving essentially the same problem.

There were some genuinely good ideas.

There were also enough overlapping approaches that understanding how a change propagated through the system could become difficult.

I found working in that environment exhausting.

Not because the problems weren't technically interesting, but because so much of the work felt like cleaning a house whose previous occupant had gone out for a glass of milk ten years earlier and never returned.

Dust everywhere.

But after spending enough time studying all those implementations, I started thinking:

_I could make this coherent._

## The first Hyperfrontend, before Hyperfrontend existed

I looked across the many different runtime-composition mechanisms and tried to understand what they actually had in common.

Instead of preserving ten slightly different solutions, what if there were one?

I was given room to explore the idea, although not the staffing or timeline I would ideally have wanted.

I spent perhaps a month or two, roughly a couple of sprints, building it.

The basic primitive was the iframe.

That statement alone is enough to make some frontend engineers recoil.

There are reasons for that reputation.

A bare iframe is not a microfrontend architecture.

An iframe gives you a separate browsing context and, when origins and sandboxing are configured appropriately, a strong isolation boundary. It does not give you cohesion.

If you want independent applications to behave like parts of one system, you have to earn that cohesion back. Communication, lifecycle, state, trust, handshaking, failure handling and all the other machinery around the primitive become your responsibility.

So I built layers around it.

At some point I proudly showed someone the communication mechanism I had designed.

There was initialization. A message. An acknowledgement. A final confirmation.

And I discovered that I had more or less reinvented a three-way handshake.

"Oh. That's TCP."

I hadn't known.

Again, I had approached the problem from first principles and eventually wandered into an idea that already had a name.

The implementation wasn't Hyperfrontend.

But it was the seed crystal.

I moved on from the company, yet the problem didn't leave with me.

## Five years of background processing

For roughly the next five years, the idea kept running somewhere in the background.

Occasionally I would start coding again.

I'd try to rebuild the original system, except better.

Then life or work would intervene.

But each attempt exposed another part of the problem.

The first implementation, for example, had been adequate for relatively low-stakes CRM interfaces.

But what would a serious version look like?

What if the thing being embedded dealt with payments?

Companies such as Stripe and PayPal had already demonstrated a narrower but important point to me: iframe-based embedding could participate in serious, security-sensitive flows. That did not prove my architecture. It did mean the primitive itself was not automatically a toy.

The primitive wasn't necessarily the problem.

The implementation around it was.

Security therefore became one of the obvious missing pieces.

I didn't know much about cryptography at the time, so I started learning.

Eventually that need became the origin of Hyperfrontend's cryptography capabilities: I wanted useful cryptographic primitives with consistent APIs across browser and Node runtimes.

The communication work from the original prototype became the seed of what would eventually become Nexus.

Packaging was another unsolved problem.

So was scaffolding.

Much later I discovered Nx and its code-generation model. For a while I thought perhaps Hyperfrontend should simply be an Nx plugin.

That seemed sensible.

Until people told me why it wasn't.

## Reddit as Rotten Tomatoes for software

If I want gentle feedback about software, Reddit is probably not where I would go.

If I want to know what technically experienced strangers think within thirty seconds of seeing an idea, it is excellent.

I think of communities such as the TypeScript and web-development subreddits almost like Rotten Tomatoes for code.

The feedback has very few soft edges.

That is useful.

Even criticism based on misunderstanding tells you something. If somebody misunderstands your project after you explain it, that misunderstanding may be evidence about your explanation rather than their intelligence.

When I initially presented Hyperfrontend, I described it as framework agnostic while simultaneously presenting it as an Nx-first solution.

People quite correctly attacked the contradiction.

Worse, the customers I imagined Hyperfrontend helping were precisely the organizations least likely to have pristine modern build systems.

Some may barely have a build command.

Why would a solution intended to accommodate technological heterogeneity require an organization to adopt my preferred monorepo tool before it could begin?

I happen to love Nx.

That didn't mean Hyperfrontend should require everyone else to love it too.

So I separated the concepts.

I wanted to preserve the good ideas: virtual trees, transactional filesystem changes, generators and structured project awareness.

But I didn't want the dependency.

That eventually became `@hyperfrontend/project-scope`.

You can think of some of its ideas as spiritually related to `@nx/devkit`, but independent.

Then I went further.

If Hyperfrontend was going to generate code in arbitrary repositories, it needed to understand where it had landed.

What projects exist here?

What frameworks?

What structure?

Where should generated code go?

What is likely to work?

Project Scope therefore developed heuristics for discovering and classifying the codebase around it.

It became far more capable than the small problem that originally caused me to build it.

That became a recurring pattern.

## Climbing mountains to reach a mountain

Building Hyperfrontend has sometimes felt like climbing Everest only to discover that reaching Everest requires climbing several other mountains first.

Hyperfrontend itself was the intended summit.

But to build it the way I wanted, I needed secure communication.

That exposed cryptography.

Communication exposed protocols and Nexus.

Scaffolding exposed Project Scope.

Distribution exposed packaging.

Packaging exposed compilation and bundling.

Release management exposed versioning.

When I later reconstructed the repository history, the sequence looked almost comically literal. The first GitHub root, from January 19, already contained six demo slots, five frontend-framework placeholders, three backend placeholders and a `features` plugin. The public shape of the idea existed before the implementation that would justify it.

The actual `@hyperfrontend/features` library did not land until June 25. The first Clock demo shipped on July 5.

The map came first.

The road took months.

![The repository timeline of 2026: the placeholders declared on January 19, the libraries and tooling of February to June, features landing on June 25, then Clock, Heartbeat and Koi Pond](/media/long-way-map-before-road/figure.webp)

And because I had made another decision early on, I couldn't simply make those problems somebody else's responsibility.

I wanted ownership.

## Ownership means accountability

Before AI, I liked writing handcrafted code.

Not because I believed I could always write something better than an established open-source project.

The appeal was ownership.

If I depended on something fundamental, I liked knowing that I could understand it, change it and be accountable for it.

That preference became stronger as Hyperfrontend developed.

The commit history makes the pattern more obvious than my memory does. I started with a wrapper around `@jscutlery/semver` and eventually replaced it with Hyperfrontend's own versioning library. Commitizen and commitlint gave way to small in-tree `cz` and `cl` tools. An in-tree Rollup executor eventually became `@hyperfrontend/builder`. `npx serve` became `hf serve`. Jest was eventually replaced by a test harness built around Node's native test runner.

That list is not proof that building things yourself is virtuous.

If anything, it is evidence that a preference can become a bias.

The useful question is whether owning the contract is worth owning the consequences.

Sometimes it is.

Sometimes the dependency was cheaper.

The JavaScript ecosystem has an extraordinary culture of dependency reuse. Sometimes that's wonderful.

Sometimes you install a tiny convenience and discover that you've acquired an entire civilization of transitive dependencies.

Each one has maintainers.

Release schedules.

Security advisories.

Its own dependencies.

Its own assumptions.

Its own future.

I particularly hate dependency vulnerability maintenance. It feels like spending engineering ability cleaning a dirty toilet: necessary work, perhaps, but work I would rather have avoided creating.

There is also a tendency toward what some people rather strongly describe as learned helplessness: reaching immediately for a ten-thousand-line dependency to avoid writing a hundred lines of code.

Historically, code reuse made that trade overwhelmingly attractive.

AI has changed the economics.

Code production has become much cheaper.

That doesn't make dependencies bad, nor does it mean everyone should rewrite everything. It does mean I think the old reflex that reuse is automatically cheaper deserves to be reconsidered.

So I made an unusual choice for Hyperfrontend.

If I was going to publish packages, I didn't want my packages to contribute to death by a thousand dependencies.

As of September 2026, seventeen of the nineteen published packages declare no third-party runtime dependencies of their own. `@hyperfrontend/builder` and `@hyperfrontend/features` are the exceptions.

Where packages inside the ecosystem need one another, I generally treat composition as _my_ responsibility rather than transferring that responsibility into the consumer's dependency graph.

The resulting artifacts can be distributed self-contained, including through formats such as IIFE and UMD where appropriate.

There are exceptions. One area still involves TypeScript/`tslib`, and Builder itself necessarily builds on serious external machinery such as Rollup.

This isn't dependency purity for its own sake.

It is about where the complexity lives.

If Hyperfrontend needs complexity to give the consumer a simpler contract, I would rather own that complexity.

## Why there are so many packages

As of September 2026, the published library surface is nineteen packages.

The runtime and composition layer includes `@hyperfrontend/features`, `@hyperfrontend/nexus` and `@hyperfrontend/network-protocol`. Tooling and repository infrastructure include `@hyperfrontend/builder`, `@hyperfrontend/project-scope`, `@hyperfrontend/questions` and `@hyperfrontend/versioning`. Lower-level primitives include `@hyperfrontend/cryptography`, `@hyperfrontend/logging` and `@hyperfrontend/state-machine`. The utility layer is `@hyperfrontend/data-utils`, `@hyperfrontend/function-utils`, `@hyperfrontend/immutable-api-utils`, `@hyperfrontend/json-utils`, `@hyperfrontend/list-utils`, `@hyperfrontend/random-generator-utils`, `@hyperfrontend/string-utils`, `@hyperfrontend/time-utils` and `@hyperfrontend/ui-utils`.

That list is long because the project grew by repeatedly turning a local problem into a reusable boundary.

![The nineteen published packages: features at the centre, Nexus and Network Protocol beneath it, primitives on the left, tooling on the right, and the nine utilities along the foot](/media/long-way-ecosystem/figure.webp)

That philosophy explains why Hyperfrontend appears to have grown sideways.

I needed compilation.

Then transpilation.

Then bundling.

Then deduplication and disambiguation.

Eventually I realized I was thinking about compiler and build-system problems just to deliver the microfrontend system I wanted.

That became `@hyperfrontend/builder`.

Builder is also one of the clearest examples of where my instincts can overshoot. The rewrite that produced it was driven in large part by Rollup exhausting memory while bundling large multi-entry libraries inside a constrained development container. The branch ran for 56 days and accumulated 206 commits.

Some of that work generalized into something I still think is valuable.

Some of it began because my environment was yelling at me.

Those are not the same justification.

If I were making that decision again, I would still consider owning the build contract. I would first work much harder to prove that I was solving a general product problem rather than architecting around the ceiling of one development environment.

But once I had built a generalized capability, deliberately crippling it so that it only worked for Hyperfrontend seemed wasteful.

So Builder became useful in its own right.

The same philosophy applies elsewhere.

If someone needs Hyperfrontend's versioning capabilities but couldn't care less about microfrontends, I would be delighted if they used the versioning package.

The package has its own value.

And perhaps someday that person lands on the Hyperfrontend site looking for versioning, notices the flagship project and thinks:

_That's interesting._

Peripheral value isn't wasted value. It concentrates attention around the ecosystem.

Versioning itself came from another mundane irritation.

I like tools such as Commitizen, commitlint and the ecosystem around conventional commits, semantic versioning and automated changelogs.

But Hyperfrontend eventually contained more than thirty projects.

Scrolling through an enormous list every time I wanted to select a commit scope became tedious.

So the versioning tooling learned to infer which projects were likely relevant. It gained filtering and other conveniences. It integrated with Project Scope.

Again, one capability began composing with another.

There are others I think deserve more attention than they currently receive.

The data utilities contain capabilities such as circular-reference detection and extensible classification. You can teach the system about new kinds of data and allow those concepts to become first-class participants in its model.

Immutable API Utils addresses another concern entirely.

JavaScript is extraordinarily powerful precisely because it is extraordinarily dynamic.

That flexibility can also be dangerous.

Monkey patching, prototype mutation and prototype-pollution-related behavior can undermine assumptions made by otherwise correct code, particularly in browser environments.

Immutable API Utils provides primitives intended to raise the baseline against that category of problem.

More importantly, I don't have to remember to use it every time.

The system remembers for me.

And that leads to another part of Hyperfrontend that isn't really a product feature at all.

## Building the machine that builds the machine

Serious development on Hyperfrontend began this year.

AI changed the amount of software I could produce dramatically.

At one stage, changing models produced a particularly noticeable jump in what I could get through in a day, but the larger realization was not about which model happened to be better at that moment.

It was about engineering around nondeterminism.

People sometimes object to AI-generated software because an LLM is nondeterministic.

That's true.

But humans aren't deterministic software generators either.

Give two experienced engineers the same problem and they may produce two completely different, equally valid implementations.

Give the _same_ engineer the same problem five years apart and they may disagree with themselves.

The useful question for me therefore became:

How much of the important part can I make deterministic?

Tests were one answer.

Hyperfrontend accumulated substantial automated testing. AI could implement behavior and write tests, and those tests then became part of the machinery that allowed subsequent AI-driven changes to happen quickly without blindly trusting the model.

A test written by the same model that wrote the implementation is not independent proof of correctness. I do not treat it as such. It is still valuable as a regression constraint once the behavior has been reviewed and accepted.

Then I became considerably more obsessive.

I started writing custom ESLint rules.

A lot of them.

The repository history contains 76 commits scoped `feat(eslint-rules)`, 51 of them between March 3 and April 28 alone. That is not the same thing as saying there are 76 rules. It does show how aggressively I moved recurring review comments into executable policy.

If I had an implementation preference that mattered enough for me to correct repeatedly, eventually I tried to stop correcting it in prose and encode it.

Some of these rules are almost annoyingly pedantic.

That's intentional.

The result is that the LLM can make decisions, but there are rails around the space in which those decisions are allowed to survive.

Initially this created another inefficiency.

The model would implement a large amount of work and then spend substantial time fighting lint failures afterward.

So I added another layer.

Skills.

## Guidance before enforcement

The distinction became simple:

**Skills are proactive alignment.**

**Lint rules are enforcement.**

If ESLint represents the wall, a skill is the sign telling you about the wall before you drive into it.

But skills introduced their own problem.

A skill that contains everything becomes useless.

Imagine asking an engineer to make a modest change and, before they're allowed to touch the keyboard, handing them a five-hundred-page handbook.

Context has a cost.

So I created a skill for creating skills.

Its philosophy is aggressive information density.

Don't explain general software-engineering practices that a capable model already knows.

Document the things a highly experienced engineer _wouldn't_ know simply because they have never worked in this repository.

Prefer signposts.

Point toward authoritative information instead of duplicating it.

Remove words that aren't carrying information.

One crude test I use is to delete a word and ask whether the meaning has materially changed. If not, perhaps that word never earned its place.

Once that skill existed, I could create others.

Including a skill explaining how this repository expects custom ESLint rules themselves to be written.

That creates an interesting recursive loop.

First I encode engineering standards.

Then I encode standards for how to encode engineering standards.

Then the AI uses those standards to extend the mechanism that constrains its future work.

The harness becomes, in a limited sense, self-reinforcing.

Today I can describe a new lint requirement in a few paragraphs of spoken language and have much of the implementation machinery take care of itself.

I still review things.

But I'm no longer repeatedly explaining how I want code written.

I spent the time turning those preferences into infrastructure.

That is what "vibe coding" misses when treated as simply asking an LLM to generate code.

The old engineering standards didn't disappear.

If anything, they became more valuable because the amount of code being produced increased.

![The engineering loop: a human defines the problem, the model proposes several candidates, deterministic rails let one through, a human reviews it, and the accepted change becomes a new rail](/media/long-way-engineering-loop/figure.gif)

## Shipping the flagship

Eventually all of this converged on `@hyperfrontend/features`, the flagship package.

It is the SDK, CLI and development-server surface that turns an existing web application into a Hyperfrontend feature and lets another application consume it. In the current vocabulary, the **host** is the containing application, the **hostee** is the application being loaded, a **feature** is that hostee treated as a product unit, and its **shell** is the self-contained package a host uses to load and communicate with it.

That vocabulary matters because the architecture is trying to separate four things people often blur together: the product unit, the running application, the containing application and the integration contract.

![A host application loading a feature shell, with the hostee application running inside a browsing-context boundary and a contract channel crossing it](/media/long-way-host-shell-hostee/figure.webp)

I remember approaching the release and barely being able to sleep.

There is a point near the end of a major milestone where you can see the finish line and suddenly pacing yourself becomes almost impossible.

I just kept working.

After years of thinking about the problem and months of serious implementation, I wanted the thing shipped.

Eventually it was.

Then I encountered the much harder problem.

Nobody is required to care.

## Open source has no org chart

Inside a company, adoption has boundaries.

If you have enough authority, influence or organizational support, you can encourage a technology to be adopted. Success might mean fifty percent adoption. Perhaps eventually one hundred percent.

But your potential audience is finite.

Open source is different.

The potential audience is enormous, but so is the competition for its attention.

Every web developer with a computer can theoretically use your project.

They can also use thousands of other projects.

Or nothing.

Having something useful isn't enough when nobody knows it exists.

That creates a surprisingly high bar for open-source presentation.

Documentation matters.

Visual polish matters.

Marketing matters.

Examples matter.

The website matters.

Trust signals matter.

Even when the thing itself is free.

An excellent solution presented terribly can disappear underneath the noise.

That realization changed what I considered "product work."

## Evidence before claims

Hyperfrontend had another problem.

I could say it worked.

Of course I could.

I built it.

What I lacked was evidence that other people were using it.

Until real adoption exists, you have to produce whatever undeniable evidence you can.

Demos became part of that strategy.

But I didn't want to build ten variations of the same hello-world application.

The demonstrations needed breadth and depth.

Some should demonstrate one deeply nuanced capability.

Others should demonstrate how many different things the architecture could tolerate.

And because Hyperfrontend hadn't yet been extensively road-tested, I assumed the demos would break it.

That became deliberate.

When AI encountered significant API friction or a genuine blocker while building a demo, it wasn't supposed to derail the entire demo to redesign Hyperfrontend.

It documented a finding.

Then it worked around the problem and continued.

Later I could process those findings individually, improve the underlying package, return to the demo and remove the workaround.

That cycle has already happened multiple times.

The first demonstration was a clock.

Simple embedding.

The historical record makes that modest demo more important than it sounds. The Clock slot had existed since the repository's first day, but the demo did not ship until July 5 — roughly five and a half months later. When it finally became a real consumer, it immediately exposed a brutal problem: the published SDK could deliver no messages at all.

That is the sort of failure I wish I had forced months earlier.

The second was Heartbeat.

It introduced session-liveness behavior while deliberately staying relatively close to the complexity of the first demo. Part of the experiment wasn't the demo itself; it was whether Hyperfrontend's generators made creating another application reproducible.

Then came Koi Pond.

## Finding the cracks on purpose

The idea for Koi Pond appeared almost as an image in my head: multiple applications, built using different frameworks, represented as fish moving continuously through one shared visual environment.

It was visually interesting.

More importantly, it was adversarial.

One of the obvious costs of iframe-based runtime isolation is duplication.

If every feature has its own runtime and framework, code isn't magically deduplicated across all of them.

Memory costs increase.

Startup costs exist.

Communication requires handshaking.

Other concerns, including SEO depending on the use case, enter the discussion.

Those are real trade-offs.

But architecture discussions often stop at identifying that a trade-off _exists_.

That isn't enough.

Trade-offs have magnitude.

An architecture might consume more memory.

How much?

It might start more slowly.

How much?

It might require an additional handshake.

Does anybody notice?

And what do you receive in exchange?

A theoretical disadvantage that costs almost nothing in the environment where you're deploying it can be a very good trade if the alternative eliminates an organizational problem costing enormously more.

So I wanted Koi Pond to hurt.

I wanted multiple isolated applications doing continuous work.

I wanted heterogeneous frameworks.

I wanted desktop and mobile.

I wanted enough pressure to discover where the architecture actually cracked rather than arguing indefinitely about where the cracks might theoretically exist.

And it did expose problems.

Good.

That was the point.

A stress test that cannot hurt the thing being tested is mostly theatre.

The protocol history is a useful example of what "finding cracks" meant in practice. A negotiated-session redesign made channels wait for a handshake instead of activating themselves. The next demos then exposed an SDK cold-start failure, a security-envelope mismatch with the heartbeat path, and liveness states that could latch incorrectly. By September, the original v1/v2 security envelope had been replaced with per-session v3/v4 protocols.

That is not a story about getting the protocol right the first time.

It is a story about creating enough pressure that the wrong assumptions had nowhere left to hide.

![Two channels on one clock: one that activates itself and loses its first message, and one that negotiates a session before anything is sent; below, the evolution from the v1 and v2 envelope to the per-session v3 and v4 protocols](/media/long-way-protocol-evolution/figure.gif)

## Documentation is part of the software

The same thinking eventually reached the documentation.

I initially used familiar tools such as Hugo and TypeDoc.

TypeDoc worked well for API material. I enforced JSDoc through linting and built automation capable of extracting code, examples and documentation into structured pages.

Eventually I had one major part of the Diátaxis model reasonably covered: reference material.

But reference documentation isn't a tutorial.

And a tutorial isn't a how-to.

Sometimes someone wants to understand a concept.

Sometimes they want to learn the system.

Sometimes they have one problem at 3:00 PM and want the shortest path to making it disappear.

So the documentation expanded into guides, tutorials, task-oriented material and longer-form writing.

Presentation also became increasingly important.

Walls of API text may be technically comprehensive while still being cognitively awful.

The rise of LLMs added another audience entirely.

Documentation is no longer written exclusively for humans.

So Hyperfrontend documentation gained LLM-oriented textual representations and mechanisms that help models discover related documentation without having to scrape and interpret presentation-oriented HTML.

Then I pushed in the opposite direction too.

If machines benefit from pure structured text, humans often benefit from less text.

An image can explain something that takes paragraphs.

Movement can explain something that takes several images.

That led to the media tooling I've been developing: effectively a programmable scene and presentation system built with HTML, with a harness capable of rendering still images, recording scenes and producing GIFs.

Those assets can become part of documentation and package artifacts themselves.

Documentation, changelogs, download information, generated visuals and API material increasingly become different surfaces over the same product rather than unrelated afterthoughts.

![Documentation as projections of one source: repository truth at the centre, thrown onto the API reference, tutorials, how-to guides, explanations, changelogs, package pages, text for models, and generated diagrams](/media/long-way-doc-projections/figure.webp)

Because again:

Nobody is required to care.

You have to make understanding the thing as inexpensive as possible.

## What Hyperfrontend is actually betting on

After all the packages, tooling, demos, protocols and documentation, the core architectural bet is surprisingly simple.

**Things change.**

Frameworks change.

Organizations change.

Teams change.

Ownership changes.

Dependencies change.

People disagree.

A framework that dominates today may be legacy infrastructure ten years from now.

JavaScript development in particular has never shown much appetite for settling permanently on one way of doing things.

Engineers also enjoy inventing.

We find new solutions to old problems, and those solutions create new problems worth solving.

AI probably won't end that.

It may accelerate it.

I sometimes describe this through the deliberately overdramatic analogy of entropy.

Physical systems don't spontaneously organize themselves forever. Maintaining order requires energy.

Organizations aren't literally thermodynamic systems, and software architecture isn't a law of physics.

But the analogy captures something I have repeatedly seen:

**cohesion requires work; divergence happens naturally.**

Many microfrontend strategies begin with substantial cohesion.

Teams coordinate around compatible frameworks, dependencies, build systems, versions or module boundaries and then introduce carefully controlled separation within that shared world.

That can be exactly the right architecture.

I've worked in environments where the organization has the capability and willingness to pay that coordination cost.

Hyperfrontend makes the opposite bet.

It begins with isolation.

Then it earns cohesion back.

The applications do not have to become the same thing before they are allowed to cooperate.

They remain isolated, but they communicate through deliberate contracts.

That is why the iframe isn't an embarrassing implementation detail I eventually intend to hide from the architectural argument.

It _is_ the architectural argument.

The browser already has an extraordinarily mature primitive for separating one application from another.

Hyperfrontend asks what happens if we take that primitive seriously, accept its costs, and build enough machinery around it to recover the things developers actually need.

That architecture isn't for everyone.

It shouldn't be.

I don't believe there is a universally correct microfrontend architecture because the problem isn't purely technical.

Perhaps 49 percent of it is code, protocols and runtime behavior.

Perhaps 51 percent is organization, ownership, topology, coordination and willingness to collaborate.

The exact percentages are obviously rhetorical.

The point is that an architecture can be technically impeccable and organizationally impossible.

I have watched that happen.

Hyperfrontend is aimed at organizations where independence isn't an inconvenience to eliminate.

It is a constraint to design around.

## Built for change

This is also why I think the underlying idea has longevity.

Hyperfrontend isn't betting that today's fashionable framework wins.

It isn't particularly interested in which framework wins.

It's betting that browsers continue to run isolated web applications and that organizations continue to contain software that doesn't all evolve simultaneously.

Could the premise eventually become obsolete?

Certainly.

Browsers could eventually provide a dramatically better primitive that makes much of this machinery unnecessary.

The web itself could change beyond recognition.

Perhaps twenty or thirty years from now we're all communicating through neural implants and arguing about an entirely different class of legacy system.

At that point, microfrontends will not be our largest compatibility concern.

For the foreseeable future, though, I'm comfortable betting on change.

## Where it goes next, for now

This is the most time-sensitive part of the story. As of September 2026, there is still plenty I want to build.

One direction is search and indexing.

I'm interested in combining Markov-chain ideas with tree structures and other deterministic data-organization techniques to build increasingly useful search over Hyperfrontend's own information.

As with the other foundational capabilities, I don't particularly want to trap that inside Hyperfrontend.

If the indexing capability is generally useful, it should be generally usable.

Hyperfrontend can then consume it.

Eventually I want someone to be able to interact with Hyperfrontend's documentation, site or terminal through a highly capable deterministic search layer with perhaps a very thin, inexpensive AI-like interface over it.

The objective isn't AI for the sake of saying AI.

It's reducing the distance between someone having a question and finding the capability that answers it.

Beyond that, the nature of the work changes.

I have spent months building.

Soon I need to spend considerably more time talking.

Marketing.

Developer communities.

Events.

Direct conversations.

Finding the organizations that have the problem Hyperfrontend was actually built to solve.

And eventually there is an enterprise side to explore: hosting, deployment capabilities, rollback, version management and the operational infrastructure surrounding independently deployed applications.

But that comes after proving something more important.

That the problem is real outside my own experience.

## The long way around

Looking backward, Hyperfrontend doesn't feel like something I invented in nine months.

It feels like the result of repeatedly encountering the same family of problems from different directions.

The first open-source project taught me that code can escape far beyond the audience you imagined for it.

Dell taught me what disciplined engineering looks like and showed me that architecture can create organizational coordination costs as real as its technical ones.

A later SaaS product showed me what happens when years of independent decisions accumulate without enough coherence, and it forced me to learn runtime composition because there was no clean world available to work in.

The first iframe implementation taught me that isolation alone isn't enough.

Reinventing a three-way handshake taught me that sometimes approaching a problem from first principles leads directly back to old ideas for good reasons.

Five years of unfinished experiments exposed the missing primitives.

Cryptography became `@hyperfrontend/cryptography`.

Communication became `@hyperfrontend/nexus`.

Scaffolding and repository awareness became `@hyperfrontend/project-scope`.

Distribution problems became `@hyperfrontend/builder`.

Commit friction became `@hyperfrontend/versioning`.

Security preferences became `@hyperfrontend/immutable-api-utils`.

Repeated coding preferences became lint rules.

Repeated instructions became skills.

The need to improve those skills produced a skill for building skills.

The absence of users produced demos.

The uncertainty around architectural trade-offs produced stress tests.

The absence of attention forced documentation to become product engineering.

And underneath all of it sits the same idea I first learned by watching microfrontends succeed and fail in very different environments:

![Cohesion first against isolation first, with Hyperfrontend placed on the isolation-first side of an axis reading where agreement is mandatory](/media/long-way-agreement/figure.webp)

**Architecture isn't just about how code is divided. It is about where you require people and systems to agree.**

Sometimes agreement is cheap.

Sometimes it is extraordinarily expensive.

Sometimes the technically elegant architecture is the one your organization cannot operate.

Hyperfrontend doesn't attempt to eliminate that reality.

It starts from it.

Let things be different.

Give them hard boundaries.

Make those boundaries reliable.

Then build the protocols that allow independent things to cooperate without first requiring them to become the same thing.

Isolation first.

Cohesion earned back deliberately.

Because if there is one thing I am willing to bet on after all these years, it isn't React, Angular, Vue, Nx, Module Federation, iframes, AI, or any particular tool I've built.

It's change.

Things will change.

The architecture should expect them to.
