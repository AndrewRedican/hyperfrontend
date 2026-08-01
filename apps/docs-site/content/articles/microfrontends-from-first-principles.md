---
title: 'Microfrontends from First Principles'
description: 'An argument from first principles: start with one iframe, press on it until it breaks, and name the five boundaries — origin, trust, contract, lifecycle, and capability — that turn containment into cooperation.'
date: '2026-07-22'
author: 'Andrew Redican'
readingTime: '39 min read'
heroImage: '/articles/microfrontends-from-first-principles/hero.webp'
mediumUrl: 'https://medium.com/@andrew.redican.mejia/microfrontends-from-first-principles-178aafe02ce5'
hackernoonUrl: 'https://hackernoon.com/the-real-cost-of-microfrontends'
---

![Two web applications composed into one product surface](/articles/microfrontends-from-first-principles/hero.webp)

You have probably heard **microfrontends** described as **a way to stitch web applications together**.

That statement is true enough to be useful, and vague enough to be grossly misunderstood.

In the third edition of the [State of Frontend](https://tsh.io/state-of-frontend#micro-frontends) survey, published in 2024, 23.6% of 6,028 respondents across 139 countries reported using microfrontends in the previous year. Roughly **one in four**.

And yet, ask the people with first-hand experience and you’ll hear wildly conflicting takes. It is either a silver bullet, a survival strategy, a regrettable scar, or something your team is definitely implementing wrong.

So you wonder, which is it?

Part of the split is simple exposure.

Microfrontends are usually **a late-game concern**. The pressure that produces them often comes from scale: long-lived products, enterprise codebases, and many teams shipping into the same browser tab. Nobody encounters that pressure in a tutorial.

Unless you inherited a legacy codebase as an intern, you can go years without ever touching this problem. Then one day you do, usually mid-incident, with everyone else’s opinions already attached.

The rest of the split is the word soup: competing definitions, high-brow takes on what is “right”, and botched implementations that get blamed on the pattern instead of the execution.

Misjudge it in either direction and you pay: complexity you did not need, or years without a tool you did need.

So, is it worth it?

As usual, the boring answer is the honest one: it depends.

Many takes stop there. This article starts there, because “it depends” is only a shrug until someone names what it depends on. Naming those things, from first principles, is the whole job here.

I have built microfrontends, inherited them, untangled them, and argued both for and against them in postmortems. This is that experience distilled into something I am willing to defend.

If you are new, you should be able to build the whole picture from scratch. If you are a veteran, you should be able to test your notions against every step of the reasoning, and I would genuinely rather you challenge it than nod along.

To argue any of that, we need a shared starting point. Not a rigid definition that locks us in early, just a premise firm enough to test.

**Microfrontends are not a default good**. **They are opt-in**, a deliberate answer to the pressure from earlier, now given its proper shape: separate pieces of frontend software living inside one product without requiring them to be built, owned, and shipped as one thing.

Where does that pressure often come from? Growth.

## The Architecture of Organic Mess

![A sprawling frontend estate of legacy portals and divergent stacks](/articles/microfrontends-from-first-principles/frontend-sprawl.webp)

**Frontend sprawl** is a **common byproduct** of long-lived products and growing organisations.

As a company scales, its digital footprint tends to fracture into a mix of legacy portals, divergent tech stacks, and slightly tweaked feature variants scattered across the user experience.

A product that starts simple eventually grows legs. New features are bolted onto old ones, yet the user experience must feel cohesive, even while the underlying codebases are actively divorcing.

A quick integration gets rolled out to bridge the gap, then quietly becomes load-bearing infrastructure. By the time a full rewrite feels necessary, it has also become slow, risky, easy to promise at the start of the year, and impossible to deliver by the end of it.

This is one common way teams stop building a single app and drift into microfrontends: usually late, often without a deliberate plan.

Deliberate microfrontend architecture in a seed-stage startup is a bit like Bigfoot: plausible, because nature can get weird, but rarely seen outside products whose shape requires it from the start.

They arrive later, as a system comes of age and the pressures that were once invisible become impossible to ignore. They tend to appear during major redesigns, high-stakes refactors, acquisitions, migrations, or the moment management notices that shipping a simple UI button requires a peace treaty between three different teams.

It is not that the early teams were careless. It is just impossible to plan for the exact shape of a monster you have not met yet.

![A product growing into a monster no one planned for](/articles/microfrontends-from-first-principles/growth-monster.webp)

Modern LLMs will not automate this away, either.

They can certainly generate components, move code around, and refactor large amounts of syntax. What they cannot do is negotiate corporate org charts.

Untangling frontend sprawl after the fact still requires a judicious balance of business needs, architectural pragmatism, ownership, incentives, and difficult trade-offs. Without shared intent, you stumble into a setup you actively detest but have invested so much time in that everyone is forced to keep living with it.

This doesn’t mean a greenfield project must adopt a microfrontend posture starting out, but teams should be aware and ready to ask the question. Perhaps slightly ahead of schedule, but certainly sooner than most realise.

The architectural choices you do not make consciously are still choices, and some of them eventually come back with invoices, strong opinions, and painful migrations.

**Good architecture** tries to **anticipate where growth will create pressure**. The best versions **make the intended path easier to follow**, but they still cannot predict the future perfectly.

Real systems grow around new business requirements, the people who maintain them, the shortcuts taken, the emergencies handled, and the lucky accidents.

Microfrontends are one way of putting terms around that mess.

So this article starts with the smallest honest version of the problem: How to embed one web app inside another.

We will get it working now, then keep pressing on it until the missing pieces reveal themselves. Each break gives us the name of a boundary we were already depending on: origin, trust, contract, lifecycle, capability.

So rather than harden our premise into a definition, we will follow the pressure until the category becomes hard to avoid.

No prior knowledge assumed. If you have written some JavaScript and seen an `<iframe>` before, you are ready.

## When embedding makes sense

Before we build anything, it is worth knowing when embedding is the right move at all.

You usually embed one app inside another when keeping them separate is more valuable than forcing them together:

- **Separate ownership.** Another team owns a feature and ships on its own schedule. You want their work inside your product without merging codebases or synchronising every release.
- **Shared product surface.** A pricing calculator, scheduling panel, document editor, or reporting view needs to appear in multiple places. Build it once, reuse it, avoid five almost-identical copies.
- **Legacy migration.** You are replacing an old application screen by screen, and the old world needs to keep running while the new one takes shape beside it.
- **Plugin-shaped product.** Your platform needs space for panels, tools, or extensions that are not all built by your core team.
- **Embeddable widget.** Your product is the thing being embedded: a checkout flow, support chat, booking form, configurator, or dashboard that lives on someone else’s site.
- **Customer-specific integration.** A customer wants part of their internal workflow stitched into your platform without turning your codebase into a museum of one-off deals.

Those are good reasons.

Whether they stay good depends on how big a boundary you draw around them, and that is worth settling before we build anything.

## When the seam is app-shaped

The good reasons above share a shape, and it is worth naming it, because not every UI composition problem deserves an app-shaped boundary.

![Design system, shared component, and app-shaped boundaries compared](/articles/microfrontends-from-first-principles/boundary-sizes.webp)

If you need a button, form field, modal, layout primitive, or visual language, you probably want a **design system**.

If you need a reusable piece of product UI with some behaviour around it, you probably want a **shared component**.

If the thing has its own ownership, release cycle, runtime assumptions, backend relationship, permissions, failure modes, and reason to exist independently, now you are closer to **microfrontend territory**.

That list gives us the working definition for this article: an **app** is anything that has to be **owned**, **shipped**, and **trusted on its own terms**.

So **pick the smallest boundary that preserves the independence you need**. Embed when the independence you need is app-shaped; if the seam is only visual or behavioural, a smaller boundary will age better.

Getting the size wrong hurts in both directions. An app boundary drawn around a visual seam is pure overhead. A component boundary forced to carry app-shaped independence drags every team into every change, shipping in lockstep, which is the exact coupling the boundary existed to remove.

So the boundary has to match the independence, and the browser happens to ship with one boundary already sized for an app: the `<iframe>`.

## The &lt;iframe&gt;

You want to show another app’s page inside yours. That app-sized seam ships in every browser as a blunt little tag.

![The iframe tag](/articles/microfrontends-from-first-principles/iframe-tag.webp)

An [`<iframe>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) embeds another HTML document inside the current one. Practically, it gives you a nested page with its own URL, document, CSS, and JavaScript.

It lets you put a whole little universe inside a box and display it.

```html
<!-- inside your app, at https://app.mysite.com -->
<iframe src="https://widgets.example.com/weather" width="320" height="200"></iframe>
```

On page load, a weather widget appears inside your layout, running from a different URL, shipped by a different system, owned by someone else.

The iframe has been around since the early days of the web, and it remains part of the browser’s normal toolbox for a reason.

It is blunt, old, and still useful.

### Isolation is the feature

What the iframe actually contributes to microfrontends is **isolation**.

And isolation is **freedom**.

The embedded app is free to use a different framework, a different bundler, a different dependency graph, a different release cadence, a different team’s taste in CSS. Your app is free to not care. Nothing inside the box joins your build, inherits your styles, shares your globals, or pretends to belong to your runtime. The embedded thing is not sort of separate. It is separate.

We could be generous and say the authors of the spec had the foresight to design the browser’s basic unit of isolation. We could also admit it was a rectangle that aged unreasonably well.

Either way, the result is the same: the **iframe** is the mainstream browser **composition primitive** where document-level **separateness is enforced** instead of merely promised by the participants.

That is why iframes keep surviving every wave of frontend fashion. Payments, maps, videos, support widgets, dashboards, customer portals, old admin screens, and third-party tools still reach for them because the boundary is honest. If you only need to show something, an iframe is a legitimate answer.

The isolation is the feature.

It is also where the complaints start.

### The complaint list

The usual criticisms of the iframe are well known, and most of them are fair observations:

- **It does not size itself to its content.** Height coordination is manual, forever.
- **Its lifecycle is opaque.** `load` tells you the browser finished doing iframe things. It does not tell you the embedded app is initialised, authenticated, healthy, or useful. And the comforting `error` event you might expect for "the app inside is broken" does not exist.
- **Styling across the boundary is mostly off the table.** Your theme stops at the border.
- **Routing and history get weird.** Child navigations can push into the host’s history, and deep-linking into embedded state takes deliberate work.
- **Focus and keyboard behaviour get awkward.** Accessibility across the boundary needs care nobody gives it by default.
- **Overlays clip to the rectangle.** The child’s modal cannot escape its box.
- **Auth can turn into a maze.** Third-party cookie restrictions were not written with your integration’s feelings in mind.
- **Each iframe is a full document**, with its own application state, dependency instances, memory overhead, and startup cost.
- **Observability does not cross over.** Errors, metrics, and traces stop at the border too.

Fair list. But it is worth being honest about what kind of list it is, because the items are not all the same species of problem.

Some of these are genuinely missed opportunities in the primitive itself.

Content-driven sizing is the obvious one; most content-sized iframe integrations end up hand-rolling the same resize dance, and it is reasonable to wish the platform had absorbed it. An application-level readiness and failure signal is the other; `load` answers a question nobody was asking. If the spec owed us anything, it owed us those two.

The rest are out of scope, and always were.

Product cohesion, shared state, auth topology, theming policy, routing agreements, telemetry: these are not features a tag can ship. They are agreements between two applications, and no primitive can sign a contract on your behalf. Blaming the iframe for not solving them is blaming the wall for not being a doorway.

So the honest accounting looks like this: charge the iframe for its two genuine omissions, forgive it everything outside its jurisdiction, and you are still left to solve the integration gaps yourself. Readiness, failure, resize, navigation, completion, dirty state, and errors all need agreed meanings across the boundary.

That is not a defect of the iframe. That is the actual size of the problem a runtime-isolated microfrontend design has to solve. The iframe is only part of a solution, and it never claimed otherwise.

### The usual alternatives

At this point, people start looking at other options. The commonly cited ones:

- **Shared package.** The feature is published as a library and compiled into the host’s build. One artifact, one deployment, one dependency graph. Cohesion is total; so is the coupling.
- **Web Components.** Custom elements composed at runtime inside one document, optionally using shadow DOM to encapsulate markup and styles. The component boundary is explicit, but the JavaScript realm is still shared.
- **Build-time integration.** Separate codebases composed at CI into a single deployable, often via a monorepo. Independence during development, one application in production.
- **Module federation.** Separately built and deployed bundles loaded into one running application at runtime, with optional negotiated sharing of dependencies. Independent deployment, shared runtime.
- **Framework-specific microfrontend runtimes.** Orchestrators such as single-spa that mount and unmount multiple applications inside one document, managing their lifecycles centrally.

All of these are legitimate. All of them buy cohesion by pulling the embedded thing closer to your build, your dependency graph, your runtime, or your framework assumptions. Sometimes that is exactly what you want. Sometimes it is the thing you were trying to avoid.

## What only the iframe gives you

Notice what the alternatives have in common: they compose into one document and one JavaScript realm.

Their dependency graphs and deployment boundaries may remain partly separate, but runtime isolation is not enforced by a document boundary. Separation therefore depends more heavily on module scopes, conventions, tooling, code review, and trust.

The iframe’s end result is different in kind, not degree: two applications sharing a screen.

The separation is not a convention that holds until someone is in a hurry. It is enforced by the browser, on every page load, whether or not anyone remembered to be careful. The other team’s global variable cannot become your bug. Their CSS refactor cannot become your incident. Their framework migration is not your migration.

That is the unique thing on offer. Not a capability, but a guarantee: **independence that survives contact**.

The alternatives start from cohesion and try to carve out independence. The iframe starts from independence and forces you to **earn cohesion back explicitly**.

That is the important bit.

## The smallest shared contract

Look back at the alternatives one more time. They sort themselves along two dimensions: when composition happens, and how much isolation survives it.

![Composition approaches plotted by composition time and isolation](/articles/microfrontends-from-first-principles/composition-axes.webp)

Wherever the approaches land on the first axis, nearly all of them collapse on the second: one document, one JavaScript environment. The iframe sits alone in the far corner: runtime composition, separate documents, boundary enforced by the browser.

Most browser-side microfrontend approaches can be located somewhere on those two axes. This article is about to commit to the far end of it, and you deserve to know why.

Start with the hosts that get no vote.

Some host environments have no build step to join. No Node, no package manager, no bundler, no shared compiler. The integration surface is a script tag, a JavaScript file, or an iframe, and that is the entire menu. Low-code platforms, CMS pages, portal products, aged admin shells: real products with real budgets, and every build-time answer is eliminated before the conversation starts.

There is a second, quieter constraint hiding in the same place.

A host you do not control is also a host you cannot negotiate with. You cannot ask it to rename a global, resolve a CSS collision, or pin a dependency. When coordination is impossible by definition, enforced isolation stops being a preference and becomes the only safe posture. That is what moves the needle past script embeds and toward the box.

Now count assumptions.

Every **integration** approach **is a contract**, and **every clause** in the contract **shrinks the set of systems** that can sign it.

Require the host’s framework, and hosts on other frameworks are out. Require compatible bundler versions, and half the org’s build configs are out. Require shared dependency versions, deploy coordination, or organisational agreement, and you have quietly excluded every team that cannot attend the meeting.

At the transport layer, the iframe’s contract begins with two clauses: both sides run in a browser, and both sides speak browser primitives. That is the smallest contract that still buys enforced isolation.

Smallest is not zero.

The embedded side must be an independently hosted, deployable web application with its own URL, which is a real cost: one more thing to build, serve, and keep alive. The claim is not that the iframe asks nothing. The claim is that what it asks is the floor.

Why prefer the floor?

Because frontend systems drift apart on their own.

Teams are hired in different years with different defaults. Dependencies reach end-of-life on uncorrelated schedules. Acquisitions import entire foreign stacks overnight. Each of those events widens the variance in your frontend estate, and the only thing that narrows it again is continuous, deliberate coordination.

**Uniformity is** not a state you reach. It is **a subscription** you pay.

**Cohesion-first** approaches bet that the subscription stays affordable.

Sometimes it does. One team, one stack, one release train: shared dependencies are pure leverage there, buying consistent UX, one hiring profile, and tooling that compounds. If that is your situation, cohesion is cheaper and you should buy it.

But the bet degrades as teams multiply.

A vulnerability in a widely shared dependency puts every affected consumer under upgrade pressure, often at the same time. Framework majors arrive on the framework’s timeline, not yours. Every shared package needs ownership, and that ownership can become a bottleneck. None of this is anyone’s failure. It is what coordination costs at scale.

An **isolation-first** boundary spends differently.

The platform **cost** is real and upfront: the protocol and tooling this article will spend its remaining length building form a product in their own right, with a maintenance budget and an owner.

Much of that cost can be paid once and amortised across the applications that adopt the boundary, while coordination costs recur and tend to grow with the number of teams. The difference is the shape of the spending, not its existence.

The same boundary also serves as a **migration** boundary.

Remember the mess: legacy running beside its replacement, acquisitions arriving mid-stack, teams modernising unevenly. A contract that does not require every team to make the same technical choices at the same time is exactly the contract those situations need. The old app keeps running. The new one grows beside it. Nobody schedules the big-bang rewrite that already slipped once.

This article follows the runtime-isolation road: iframes, messages, and the agreements that turn containment into cooperation. It will not survey the other roads in depth.

If your world is one team, one stack, one release train, on a host you fully control, take the cohesion road with this article’s blessing. Module federation and its cousins are good at what they are for, and nothing below will scold you for using them.

Two words before we go, because “the embedded application” is about to get tedious:

The application that provides the containing product surface is the **host**. The application loaded inside it is the **hostee**.

Dictionary or not, the suffix does honest work: an employee is the one employed, an addressee is the one addressed, and a hostee is the one hosted.

When we drop down to raw window mechanics, the platform’s own vocabulary applies instead: parent and child, because the API literally says `window.parent`.

Host, hostee, and the smallest transport contract the browser can offer.

Time to earn the cohesion back.

## Earning cohesion back

A bare iframe gives you containment, not cohesion: two applications share a screen, and that is the full extent of what they agree on.

The browser gives you [`postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), the sanctioned way for windows and iframes to talk across origins. But `postMessage` is not a product contract. It is a pipe. If you want readiness, failure, resize, navigation, completion, dirty state, or errors to mean anything, the two sides have to agree on what they mean.

So a bare iframe is usually not enough for a serious product integration. Real implementations grow a wrapper around it:

- a message protocol
- a resize contract
- loading and failure states
- permission rules
- security checks
- agreed lifecycle events

Each of these gets its own treatment later. We will start with the plain version, then add the missing agreements one by one.

## Passing notes: postMessage()

The plain version first, as promised.

You want the two pages to exchange information, and between two windows on different origins, the browser’s direct communication primitive is [`postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

The host and the hostee are two rooms with a locked door between them.

Neither can walk into the other, but there is a slot in the door. Either side can push a note through; either side can stand by the slot and read notes as they arrive.

![Host and hostee passing notes through a slot in a locked door](/articles/microfrontends-from-first-principles/passing-notes.webp)

Two calls make it work:

- [`someWindow.postMessage(data, targetOrigin)`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) pushes a note toward another window.
- [`window.addEventListener("message", handler)`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) reads notes as they arrive.

If you have used an event bus or [pub/sub](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern), this is that, just between two browsing contexts instead of two modules.

A **browsing context** is a window, tab, or iframe with its own global scope; each of our two apps runs in its own. One context publishes, the other subscribes and reacts.

For ordinary values, the data is not shared by reference.

The browser serializes it using structured clone, which is why objects and arrays work but functions and DOM nodes do not. Transferable objects are the exception: they can be moved rather than copied.

What comes out the other side is a note, not a reference into your room.

Wire up the weather widget for real. The host page:

```html
<iframe id="weather" src="https://widgets.example.com/weather"></iframe>
<script>
  const frame = document.getElementById('weather')
  // wait until the iframe has loaded, then push a note through the slot
  frame.addEventListener('load', () => {
    frame.contentWindow.postMessage(
      {
        type: 'set-city',
        payload: {
          city: 'Lisbon',
        },
      },
      'https://widgets.example.com'
    )
  })
  // read notes coming back from the widget
  window.addEventListener('message', (event) => {
    console.log('the widget said:', event.data)
  })
</script>
```

The widget, on its own origin, listens and answers:

```js
// inside https://widgets.example.com/weather
window.addEventListener('message', (event) => {
  if (event.data.type === 'set-city') {
    showWeatherFor(event.data.payload.city)
  }
})
// tell whoever embedded us that we are awake
window.parent.postMessage({ type: 'ready', payload: null }, '*')
```

Run it and the two apps hold a conversation. The host says “show Lisbon”; the widget shows Lisbon and sends its own events back (“user opened the 5-day forecast”). You have built a tiny protocol out of `type` strings and payloads.

Here is the same exchange as a diagram:

![Sequence diagram of the host and widget exchanging postMessage notes](/articles/microfrontends-from-first-principles/postmessage-sequence.webp)

Two details in this code are deliberately careless:

First, the widget posts to `'*'`, and neither listener asks where a message came from before acting on it.

Second, the host treats `load` as proof that the widget is ready and sends `set-city` immediately. It may not be: `load` tells us that the document loaded, not that the application is listening. If the listener is not in place, the message simply disappears into the ether. The widget’s own `ready` signal is more honest, but the host does nothing with it.

We will come back to both shortly.

For now, this works. You can embed one app inside another and make them cooperate.

Now, let’s break it.

## Origins

Look again at the code. The widget loads from `https://widgets.example.com`; your app lives at `https://app.mysite.com`.

Those are two different origins.

An origin is the tuple of **scheme**, **host**, and effective **port**. Change any member of that tuple to a non-equivalent value and the origin changes:

- `http` ≠ `https`
- `app.mysite.com` ≠ `widgets.example.com`
- `mysite.com:3000` ≠ `mysite.com:3001`

These are all different.

This matters because of a rule baked into the browser’s bones: the [**same-origin policy**](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).

Code from one origin cannot directly read or manipulate another origin’s DOM or JavaScript state.

Not “should not”. Cannot.

The browser refuses.

![The browser blocking cross-origin DOM access](/articles/microfrontends-from-first-principles/same-origin-policy.webp)

Something like this does not work:

```js
frame.contentWindow.document.querySelector('body')
```

The browser blocks it. If it did not, any page you opened could inspect the contents of another site loaded in a frame.

Cross-origin is not an accident we are working around. It is usually the point.

If another team deploys to its own domain on its own schedule, its feature is likely to live on another origin. The independence you wanted and the wall the browser puts up are the same fact seen from two sides.

`postMessage` exists because of that wall. The browser will not let the applications touch directly, but it will carry structured messages between them, with each side deciding what to send and what to accept.

Same-origin embedding is the easier case. Once everything shares an origin, richer forms of integration become possible, and importing the code may be the better answer anyway.

Cross-origin embedding is where the boundary earns its keep.

Press on the plain version and it splits along a line the browser drew from the start.

That line is the first boundary: **origin**.

The second is sitting in the same code. Two windows are passing notes without asking who is on the other side.

## Trust: addressing, pinning, and authorisation

Starting with the earlier widget’s final line:

```js
window.parent.postMessage({ type: 'ready', payload: null }, '*')
```

The second argument is the [`targetOrigin`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin).

`'*'` means: deliver this to whoever is there.

![A message posted with a wildcard target origin reaching an unknown parent](/articles/microfrontends-from-first-principles/target-origin-wildcard.webp)

Today, whoever-is-there is your host. But the widget does not choose its parent. Any page can write:

```html
<iframe src="https://widgets.example.com/weather"></iframe>
```

For a bare `ready` message, perhaps nobody cares. However, protocols rarely stay that small.

The day the widget reports a saved city, a session hint, a half-finished draft, or anything else with weight, `'*'` delivers it to whichever page embedded the frame, including pages your team has never heard of.

The same trap exists on the host side, although it is easier to miss.

Our host passed a proper target origin:

```js
frame.contentWindow.postMessage(
  {
    type: 'set-city',
    payload: {
      city: 'Lisbon',
    },
  },
  'https://widgets.example.com'
)
```

That origin is doing more work than it looks like.

Frames navigate. A link, redirect, or bug may replace the original widget with another document. Post with `'*'` and the payload follows the rectangle to its new tenant. Post with a specific origin and the browser checks the current occupant before delivering anything.

So: **address the note**.

That is straightforward for the host. It wrote the iframe’s `src`, so it knows the hostee’s expected origin before the frame exists.

The hostee is in a different position. It wakes up inside a parent it did not choose. Hardcoding one host origin would destroy the universal embedding we are trying to preserve.

That assumption changes when you control both ends:

For an internal feature with a single known host, hardcoding or configuring the host origin is the simplest correct choice.

Dynamic discovery is only needed when the same feature must support hosts you cannot enumerate in advance, such as a third-party widget distributed to independent consumers.

The browser does provide part of the answer.

Every incoming message carries `event.origin`, the origin from which the browser received it.

That lets the hostee learn the origin of its current counterpart and bind the conversation to it.

Let’s be precise about what that means.

Pinning an origin answers:

> _Am I still talking to the same counterpart I started with?_

It does not answer:

> _Was that counterpart ever allowed to embed me?_

![Origin pinning versus embedding authorisation](/articles/microfrontends-from-first-principles/pinning-vs-authorisation.webp)

Those are different jobs.

For a publicly embeddable widget, any host may be acceptable. The pin exists to keep each conversation consistent, not to keep strangers out.

For a restricted widget, authorisation has to happen outside origin pinning, at the framing and server boundaries. The HTTP response that serves the hostee document can declare which sites may frame it:

```http
Content-Security-Policy: frame-ancestors https://app.mysite.com
```

The browser then refuses to render it inside any other parent.

Where the feature has a backend and something meaningful to protect, the opening exchange may also carry credentials that the server can validate.

Pinning keeps the conversation stable.

And `frame-ancestors` decides whether the host may embed the hostee; credentials and server-side authorisation decide which protected operations the authenticated caller may perform.

Now look at the host’s listener from the earlier example:

```js
window.addEventListener('message', (event) => {
  console.log('the widget said:', event.data)
})
```

It accepts messages from anyone.

Any window holding a reference to your page may post into it: another iframe, an opener, or a popup left hanging around.

The first fix is to check the origin:

```js
if (event.origin !== 'https://widgets.example.com') return
```

There is another check that belongs beside it.

An origin identifies a place, not a particular window.

Embed two widgets from the same origin and both pass the same origin check. The message event carries the missing identity in `event.source`.

A careful host binds the conversation to both:

```js
const frame = document.getElementById('weather')
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://widgets.example.com') return
  if (event.source !== frame.contentWindow) return
  console.log('the widget said:', event.data)
})
```

Now the host knows that the note came from that widget, not merely from somewhere on the widget’s domain.

The hostee can make the equivalent comparison against `window.parent`.

One loose end remains. The first message may need to travel before the hostee knows which origin to address.

That is tolerable under a narrow rule: **the only note allowed to travel unaddressed carries nothing worth stealing**. A knock on the door holds no secrets. Everything after the knock is addressed, or it does not move.

Even with all of this, origin and window checks have a limit.

Every script running inside a page shares its window. An analytics snippet, tag manager, chat widget, or compromised dependency can listen at the same slot and send messages of its own. When it does, `event.origin` reports the page’s real origin, because that is where the script is running.

Origin checks authenticate rooms, not speakers.

![Origin checks authenticate rooms, not speakers](/articles/microfrontends-from-first-principles/rooms-not-speakers.webp)

Once arbitrary script can run inside either page, origin and source checks cannot distinguish that script from the application itself.

Addressing that threat requires isolating secrets or authority from the page’s shared JavaScript realm, not merely adding another message check. That deserves a separate security treatment, so this article keeps it outside the stated threat model and points to further reading at the end.

Everything below trusts the scripts already running in both rooms and binds messages to the expected windows and origins.

Taken together, those decisions determine who you address, which window you bind to, how embedding is authorised, and which adversaries remain outside the model. That is the second boundary: **trust**.

Meanwhile, the notes themselves have been coasting on good manners.

`set-city` worked because both sides happened to type the same eight characters.

Happened-to is not an agreement.

## One design among several

From here, the answers stop being browser hygiene and become architecture.

There are several defensible ways to build a protocol over `postMessage`.

The following sections describe one of them: the design I use, the trade-offs behind it, and the places where a different system may reasonably choose another fork.

## The contract

Look at the first code block again. Two kinds of message crossed the boundary, and they were not the same species.

`set-city` is a command. The host asks the hostee to do something.

`ready` is an event. The hostee announces something that has already happened.

On the wire, they look alike: a type string and a payload. That resemblance is the trap.

The channel does not know what either message means. It carries notes.

Meaning exists only in the agreement between two codebases that may be owned, deployed, and changed by different teams.

Break it the way real teams break it: with a cleanup.

The widget team decides `set-city` should be `setCity`, consistent with the rest of its codebase, and ships the change on Tuesday.

No exception is thrown. No request fails. No console goes red.

The host keeps posting `set-city`. The widget keeps waiting for `setCity`.

The feature does not crash. It goes quietly deaf.

Grep both repositories and you will find the problem in a minute. Nothing at runtime will find it for you, because every message was delivered successfully.

Delivery was never the problem. Meaning was, and meaning lived in two heads and zero files.

So write the vocabulary down.

For every message that crosses the boundary, record:

- its **name**;
- its **direction**;
- the **shape of** its **payload**.

Two verbs cover direction. A side **emits** the messages it sends and **accepts** the messages it is prepared to receive.

Using a deliberately schematic notation:

```js
const contract = {
  version: 1,
  emits: {
    ready: {
      payload: null,
    },
    'forecast-opened': {
      payload: {
        day: 'number',
      },
    },
  },
  accepts: {
    'set-city': {
      payload: {
        city: 'string',
      },
    },
  },
}
```

The strings above stand in for executable schemas. In production, each entry needs a validator the runtime can actually enforce.

This contract is written from the hostee’s perspective.

The host does not need to maintain a separate mirror by hand. It can invert the same artifact:

```js
function invert(contract) {
  return {
    ...contract,
    emits: contract.accepts,
    accepts: contract.emits,
  }
}
```

Everything the feature emits, the host accepts. Everything the feature accepts, the host may emit.

One artifact, two perspectives.

This is not the only viable arrangement. Two separately owned contracts with a compatibility check can work perfectly well, particularly where every participant has a build pipeline and a central platform team.

The single-artifact approach makes a different trade. It reduces the amount of agreement required from hosts, including hosts with no CI, package manager, or codebase in which to run that checker.

It also has a seam of its own.

“The name exists in one place” may be true in source control. Production is less tidy.

## Contract versioning

The feature deploys version two this afternoon. A host may still be running a shell it bundled last month. There is one contract in the repository and two vintages in the field.

The silent rename has returned through the deployment door.

That is why **the** **contract** needs a **version**.

The sample above already carries one. It is not a separate announcement: the version is baked into the contract artifact each side bundled, so the vintage a side runs is the vintage it presents.

When two sides first meet, each presents the contract it holds — version included — and a compatibility rule evaluated during the opening exchange decides whether the pair may proceed. An incompatible pair fails explicitly, refused before the session opens, instead of going silently deaf three weeks later.

Adding an emitted event can remain compatible when unknown events are ignored and logged rather than treated as fatal.

Adding a command the feature is prepared to accept is also compatible; no existing host is required to send it.

Renaming a message or changing the required shape of its payload is breaking and calls for the version to be increased.

Versioning does not stop systems from drifting. It makes the drift visible at the earliest moment the two versions encounter one another.

Now break the message a second way: right name, wrong shape.

```js
{
  type: 'set-city',
  payload: {
    city: {
      name: 'Lisbon'
    }
  }
}
```

The widget expected a string. It receives an object, renders `[object Object]`, or throws several components away from the boundary where the bad value entered.

This is why each contract entry carries a schema and why that schema is enforced twice.

On send, malformed data fails in your room, with your stack trace, before it crosses.

On receive, malformed data is rejected at the border instead of detonating somewhere inside the other application.

Origin and source checks establish which origin and window sent the message. They say nothing about whether what was said is well-formed.

## Requests and responses

The contract so far contains only one-way notes, and products are rarely that polite.

Some exchanges are questions:

- Is the form dirty?
- Give me the current draft.
- Did the save finish?

One-way messages can represent these, but teams under pressure soon invent reply types, correlation conventions, and timeout behaviour. Six months later, the codebase contains a remote-procedure protocol nobody deliberately designed.

The sin is not request and response. The sin is accidental RPC.

So requests become an explicit species in the contract. A request carries an identifier. Its response carries the same identifier back. A deadline turns silence into an error instead of an eternal wait.

```js
// request
{
  type: 'get-draft',
  id: 'q_4821'
}
// response
{
  type: 'get-draft:result',
  id: 'q_4821',
  payload: {
    text: '…'
  }
}
```

It is still a note crossing a boundary, but now it has a return address and an expiry date.

The lifecycle and integration features built next, including readiness, sizing, health, and teardown, will need messages of their own. Those messages should use the same contract, schemas, and transport as the product messages they govern.

These pages will give them an `@shell/` prefix:

```text
@shell/request
@shell/accept
@shell/open
@shell/size
@shell/beat
```

No privileged side channel. No separate set of rules for the plumbing.

If the contract cannot express its own control protocol, it is probably incomplete.

That is the third boundary: **contract**. It is the written record of what crossing the wall means, including how that record is allowed to change.

One of those control messages has been waiting since the first code block.

The widget said `ready`, and nobody listened.

Worse: we could not have listened reliably even if we had tried.

## The session lifecycle

The oldest loose end in the article is the host’s faith in `load`.

The first code block waited for the iframe’s load event and immediately sent `set-city`.

But `load` answers a browser question. It tells you that the framed document reached the browser’s `load` milestone.

It says nothing about the application inside.

The app may still be booting, hydrating, waiting for authentication, or dead on arrival behind a white screen. Send `set-city` into that gap and the message may arrive before the widget has attached its listener.

The property that makes this fatal is simple: the channel has no memory.

`postMessage` queues delivery as a browser task, but it provides no persistent application **queue**. If the event is dispatched before a listener is attached, it is not retried or rejected.

It is gone.

Fine, we say. Wait for the widget’s `ready` message instead.

The same problem appears from the opposite direction.

A small widget on a warm cache may send `ready` before the host attaches its listener. Same channel, same missing memory, same silent loss.

Either side can speak too early.

So each side buffers outbound messages until it knows the other is listening.

Which raises the actual question: How does either side ever know?

Take it one step at a time.

The hostee sends `@shell/request`, asking to open a session.

Did the host receive it?

The hostee cannot tell. The channel provides no receipt. The opener therefore retries `@shell/request` until it receives `@shell/accept` or the opening deadline expires.

So the host answers with an acknowledgment, `@shell/accept`.

Now the hostee knows its request was received. The host still does not know whether `@shell/accept` arrived, so the hostee confirms with `@shell/open`.

```text
request → accept → open
```

The opening messages must be idempotent. A duplicate request replays accept, a duplicate accept replays open, and a duplicate open changes nothing.

Why stop at three?

Not because three messages make the channel certain. Nothing does.

After `open`, each side has evidence that the other has both sent and received at least once during this session. That limited property is enough to begin releasing queued messages.

TCP’s **three-way handshake** solves a related shape of problem with the same number of exchanges. That is useful precedent, not proof that every three-message protocol is correct.

The handshake does not guarantee that the next message arrives. It does not guarantee that either application survives the next tick. It only establishes a live conversation at one point in time.

Each application also mints a fresh **instance identifier** whenever it boots.

That instance ID separates one incarnation from the next.

If the iframe reloads halfway through a session, messages left over from the previous instance identify themselves as stale instead of being accepted into the new conversation.

The contract-version comparison belongs in the handshake too. Each side's contract crosses in `@shell/request` or `@shell/accept` with its baked-in version aboard, and a compatibility rule evaluated during that exchange denies an incompatible pair before product messages begin moving.

The exchange is symmetrical. Either side may finish booting first and send the opening request. The other accepts; the first confirms.

Host and hostee can run the same state machine without one of them being permanently responsible for starting it.

Symmetry also permits both sides to initiate at once.

The state machine must collapse simultaneous requests into one session, for example by deriving the session identity from both instance IDs and treating both opening paths idempotently.

The handshake also gives the hostee a better moment to pin the host origin.

A message that merely resembles the protocol is weak evidence. A counterpart that completes the opening exchange has demonstrated that it understands enough of the protocol to participate.

That still does not authorize it. A hostile parent capable of completing the handshake may still win the pin. Authorisation remains the job of `frame-ancestors`, credentials, or whatever policy the product requires.

Next crack: what if the answer never comes?

## Deadlines

The URL returns a 404. The app throws during startup. A content security policy blocks the document. The host waits forever.

A handshake without a deadline is a hang with good intentions.

So it gets a **timeout**.

When the deadline expires, the host receives an application-level failure state it can render: fallback content, a retry button, or an explanation.

The platform never gave the iframe a useful application failure event. A timer plus an agreement can.

The handshake proves that the other application was alive once.

Alive once is not alive now.

Applications wedge in loops, throw after startup, or get suspended by the browser. The obvious response is a periodic **pulse**, `@shell/beat`, and a watchdog that notices when those pulses stop.

Browsers throttle timers in background tabs and may freeze hidden pages for long periods. A widget may fall silent because the browser parked it, not because the application failed.

## The heartbeat and its four states

A useful lifecycle therefore needs more than a boolean.

**Healthy** means pulses are arriving within the expected budget.

**Unobservable** means browser lifecycle conditions make silence weak evidence, for example because the page is hidden or either side has reported entering a state where timers may be throttled or suspended. Watchdogs should pause or widen their expectations there.

**Suspect** means the page is visible, the budget has been exhausted, and the relationship is probably unhealthy.

**Gone** means the session has actually been closed or destroyed.

Only `suspect` should invite automatic recovery, and even then the response should be proportionate: degrade first, offer a reload second, force one only when the product can justify it.

A watchdog that repeatedly reloads healthy applications is causing the outage it exists to detect.

A lifecycle that covers only birth is still incomplete, so teardown gets a protocol too.

The polite form is a short exchange. One side proposes closing. The other flushes whatever it must, such as an unsaved draft or pending write, then confirms. The frame can be removed.

The impolite form is one message or none. A tab closes. A page crashes. A device loses power.

A real lifecycle plans for both because only one of them asks permission.

Dirty state is simply another contract event. The hostee can declare that it holds unsaved work, and the host can take that into account before starting a polite teardown.

That is the fourth boundary: **lifecycle**.

Born, opening, ready, healthy, unobservable, suspect, closing, gone. The transitions that require agreement have messages, every wait has a deadline, and the model states what silence may mean.

One boundary remains, and it governs something none of those messages can decide:

What may the box itself do?

## What may the box do?

The browser has a second lock.

The same-origin policy keeps the hostee’s DOM and JavaScript state away from the host. It says nothing about what the hostee may do with the browser around it.

Open popups. Navigate the top-level page. Enter fullscreen. Ask for the camera. Autoplay audio. Trigger downloads.

Two iframe attributes govern much of that surface: `sandbox` and `allow`.

`sandbox` starts from denial.

```html
<iframe sandbox src="…"></iframe>
```

The bare attribute removes a broad set of capabilities. Common tokens selectively return capabilities such as:

```text
allow-scripts
allow-forms
allow-popups
allow-modals
allow-downloads
allow-top-navigation
allow-top-navigation-by-user-activation
allow-same-origin
```

`allow-same-origin` deserves particular attention.

Without it, a sandboxed frame receives an opaque origin that matches nothing, including its real deployment origin. That breaks any protocol relying on stable origin checks.

A cross-origin hostee that needs JavaScript and the stable origin checks described here will generally need both `allow-scripts` and `allow-same-origin`.

The same pairing becomes dangerous when the framed content is served from the host’s own origin. In that case, the frame may be able to remove its own sandbox and reload without the restriction.

The pairing is useful across origins and self-defeating within one.

The `allow` attribute controls delegation through Permissions Policy:

```html
<iframe src="…" allow="fullscreen; clipboard-write"></iframe>
```

Powerful features such as the camera, microphone, geolocation, fullscreen, payment, or clipboard access can be made available to a particular frame instead of being left to broad defaults. User permission, activation, and API-specific requirements may still apply.

Both attributes are written by the host.

The hostee cannot grant itself browser capabilities. Capability flows from the containing page into the frame.

The important question is not merely whether the host trusts the hostee.

A trusted feature can still have a bad day.

A transitive dependency is compromised. An injected script behaves unexpectedly. A normal bug navigates the top-level page because someone forgot a link target.

Choosing a dependency does not eliminate those possibilities. Restrictions can limit their blast radius without treating the feature team as an adversary.

The two attributes do not cost the same.

Permissions Policy is usually the cheaper lever. Delegate only the powerful features the integration actually needs. A feature can list those needs beside its contract so the host’s policy is explicit and reviewable.

`sandbox` requires a more careful price check.

Some restrictions are cheap. Preventing unrestricted top-level navigation blocks an entire class of incidents and rarely harms a legitimate flow.

Others interfere directly with the product: a checkout may need popups, a report may need downloads, a media experience may need fullscreen.

The method is not to add every token or reject the attribute altogether. Start from the capabilities the feature requires and grant those deliberately.

The posture is stricter for genuinely untrusted content, including marketplace plugins, user-generated embeds, and integrations you would not treat as installed dependencies.

Start from a bare sandbox and return capabilities one at a time, with each token justified by a product requirement.

Same tag, different threat models.

The question underneath both is:

Whose misbehaviour are you pricing in?

That is the fifth boundary: **capability**.

Origin, trust, contract, lifecycle, capability.

Five is not a law of nature. It is where pressing on this design stopped producing a new kind of crack.

A different product may uncover a sixth. The method remains the same: press on the working system, watch where it splits, and name the agreement that was missing.

Two questions remain.

What did all this protocol work do about the original complaint list?

And who, in a real organisation, writes it?

## Collecting the complaints

The iframe section made a list of complaints and promised honest accounting.

Time to settle it.

Start with the two features the primitive itself most conspicuously lacks.

### Application readiness and failure

That became the **handshake**, its **version exchange**, its **timeout**, and the later **health signals**.

`load` still answers the browser’s question. The host no longer mistakes it for application readiness.

The host learns that the application is initialised and speaking a compatible contract from `open`.

It learns that startup failed when the handshake deadline expires.

It learns that a previously healthy session has become suspicious when pulses stop under conditions where silence is meaningful.

That last signal remains a judgement, not an oracle. The lifecycle has to preserve that distinction.

### Content-driven sizing

This is the familiar resize dance, and a shared protocol lets you implement it once rather than once per feature.

The tempting shape is the one most hand-rolled integrations reach for: the embedded document announces its own height, and the host applies it. It works, until you ask who is in charge. The host is now applying whatever number arrives, unbounded, to its own page. Geometry authority has quietly moved to the wrong side of the wall.

So the agreement runs the other way. The host owns the page, so the host owns the measurement. It observes the container it mounted the frame into and reports that box’s dimensions across the boundary whenever they change:

```js
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect
    send({
      type: '@shell/viewport',
      payload: { width, height },
    })
  }
})
observer.observe(container)
```

A production-ready implementation also needs the box model handled deliberately, deduplication, and fallback dimensions for a container that has not been laid out yet. That detail goes beyond the scope of this article.

The hostee sizes its document to the reported numbers. Every dimension that crosses the wall is a resolved pixel value; no relative unit means anything on the other side of a document boundary.

A feature with intrinsic dimensions declares them in the contract instead, and its frame receives them exactly. Placing it somewhere it fits is the host’s job.

The embed-grows-with-content behaviour is still available, as an ordinary contract message: the feature reports its content height as product data, and the host, which owns the container, decides whether the container grows. The dance is the same. The authority is not.

`@shell/viewport` receives no special treatment. It uses the same channel, schema validation, session identity, and pinned counterpart as everything else.

### Overlays

The child’s modal cannot escape its document, and it never will.

So the document does not escape. The wall opens a bigger pane.

For a dialog, the host lays a second frame over its own page — full-viewport, transparent — and the feature draws its dialog box inside it. Everything around the box is backdrop, and the host page shows through wherever the feature paints nothing.

Only the feature can hear a click on that backdrop, or an Escape pressed in its document; focus lives inside the frame. So it reports both across the boundary as a dismiss signal. Whether the signal closes the dialog, surfaces as an event, or is ignored is agreed in the contract and enforced by the host.

Which presentations a feature supports is declared in its contract. Which one it gets is the host’s call.

The wall does not move. It was always allowed to have more than one opening.

### Observability

This design does not erase the boundary here.

The same isolation that prevents the hostee’s errors from becoming the host’s runtime also prevents the host from automatically receiving the hostee’s full stack traces.

What should cross are failures in the relationship: timeouts, rejected messages, incompatible contracts, denied requests, and liveness suspicions.

The hostee’s internal telemetry still belongs in the hostee’s monitoring system, where the team responsible for that application can act on it.

That creates a real operational cost. Debugging a flow that spans both applications requires correlation IDs and cooperation between teams. Where no responsive team exists on the other side, the cost is worse.

### Styling and theming

Still deliberate. CSS does not cross the document boundary, so shared tokens or theme values have to cross as data, with each application deciding how to apply them.

The remaining complaints stay mostly where they were.

**Routing and history:** still real. Embedded state can be represented through deliberate messages, but child navigation and host history remain something to design around.

**Focus and keyboard behaviour:** still requires care. A protocol may carry focus requests, but no message removes the accessibility work.

**Authentication and cookies:** still larger than the wrapper. The boundary forces both applications to confront explicitly what shared cookies once hid.

**Memory and startup:** still the price of a second document. You are paying for another application because you asked the browser to keep it separate.

Some complaints were answered by the shared protocol.

Some turned out to be the isolation guarantee doing exactly what it promised.

Some remain standing, with their costs visible.

That is the accounting.

## The shell

Most of the previous sections broke code.

This one breaks the organisational model.

Tally what “an iframe plus a few agreements” has become:

- a versioned contract;
- schemas enforced on send and receive;
- origins pinned to particular windows;
- outbound queues;
- a three-message handshake with a deadline;
- instance identities;
- health signals and watchdog states;
- polite and abrupt teardown;
- sizing messages;
- display modes;
- an error surface.

Every line is glue.

Somebody has to write it for every feature and every host.

Now carry that requirement back to the systems this article started with.

The low-code portal has no build pipeline through which to consume and enforce a typed protocol implementation.

The acquired application uses a stack nobody else runs.

The legacy administration shell is maintained by one person on Thursdays.

The whole argument for the smallest contract was that these hosts exist and cannot afford another negotiation. Handing each one a protocol specification and wishing it luck defeats the point.

If a host cannot write the glue, the glue has to arrive already written.

![Integration glue shipping together with the feature](/articles/microfrontends-from-first-principles/glue-ships-with-feature.webp)

There are two obvious places it can live.

A central platform team can ship a host-side SDK and require every feature to conform to it. Where that team exists, has authority over the hosts, and can maintain the integration surface, that model can buy substantial leverage.

The cases this article keeps returning to are the ones where no such authority exists: hosts outside the company, hosts without builds, hosts on stacks nobody can schedule, and hosts maintained by teams with no reason to adopt your platform SDK.

There, the feature team is usually best positioned to ship the integration. It already owns the feature’s URL, contract, and release.

So the glue ships with the feature.

One package carries the contract, speaks the protocol, manages the queues, performs the handshake, pins the counterpart, validates messages, watches health, and tears the session down.

It bundles its own dependencies so that the host does not inherit another compatibility negotiation.

And it arrives in both forms the browser-only contract permits:

- an npm import for hosts with a build;
- a script tag for hosts without one.

A React application mounts a component and passes properties.

A CMS adds a script and points it at an element.

Both execute the same integration runtime and receive the same protocol behaviour.

The host’s job collapses from implementing the boundary to declaring where the feature belongs.

Call that outward-facing package the **shell**: the part of a feature that wraps its boundary protocol and presents the application to any host capable of running a browser.

At this point, the article is no longer merely describing a microfrontend pattern.

It has written a protocol precisely enough that somebody could implement it.

That somebody already has.

## The bill, and who paid it

The wrapper list from “Earning cohesion back” returns one final time, each item now attached to an answer.

- A message protocol: the contract.
- A resize agreement: `@shell/viewport`.
- Loading and failure states: the handshake, deadlines, and health model.
- Permission rules: `sandbox` and Permissions Policy.
- Security checks: origin, source, authorisation, and validation.
- Lifecycle events: opening, health, and teardown.

Every item received the treatment it was promised.

The implementation behind these choices is mine.

It is MIT-licensed and dependency-free, and it follows the architecture described here: a shared contract viewed from both sides, iframe isolation, browser messages, learned and pinned counterparts, lifecycle control messages, and a shell consumable as an import or script tag.

**Hyperfrontend:** [Documentation](/) · [Source code](https://github.com/AndrewRedican/hyperfrontend)

I am disclosing that because everything beyond the browser primitives reflects design choices embodied in my implementation.

This article explains the reasoning behind those choices; it does not present them as the inevitable shape of frontend architecture.

The implementation should be judged against the same calculus as the pattern itself.

One team, one stack, one release train, on a host you completely control: you probably do not need it.

You did not need it at the start of this article, and nothing since has changed your circumstances. Shared dependencies are leverage in that world. Module federation and related approaches are good at what they are built to do.

Many teams, drifting stacks, hosts you cannot negotiate with, a migration that must keep old and new alive together, or an acquisition arriving with its own frontend estate: then the protocol and operational work above are not an imaginary tax invented by this article.

It is roughly the bill you will discover item by item while building the boundary yourself.

Whether you build it in-house, use this implementation, or choose another one, the useful part is knowing what you are paying for.

The load-bearing claims are now visible:

- enforced isolation becomes more valuable as coordination becomes harder;
- a shared, versioned contract is worth the coupling it introduces;
- the handshake establishes enough shared state to release queued messages;
- origin and window pinning are sufficient to bind messages to the expected browsing contexts under the stated trust model;
- the health model distinguishes silence from failure well enough to guide recovery;
- shipping glue with the feature is preferable where no host platform can impose it centrally.

Challenge any one of those and some part of the design changes downstream.

That is the correct standard for an argument from first principles.

The architectural choices you do not make consciously are still choices, and some of them eventually return with invoices.

**These were the conscious ones.**

![The conscious architectural choices, laid out](/articles/microfrontends-from-first-principles/conscious-choices.webp)

### Further security considerations

This article assumes that scripts already executing inside the host and hostee are trusted.

Threats inside either page require a different treatment: Content Security Policy, Trusted Types, Subresource Integrity and dependency provenance, server-side authorisation, and designs that isolate sensitive authority in a separate origin or execution context.

As promised, Hyperfrontend includes related defence in depth facilities. These do not replace the core controls above or make a compromised page trustworthy. They provide narrower protections whose guarantees and limitations are documented separately.

Start with the model, which states the same threat boundary this article assumes and then names which party owns each control:

- [Security Model](/docs/core-concepts/security)

Then the implementations, from the two libraries that carry this article's subject down to the primitives beneath them:

- [Features](/docs/libraries/features/architecture) — the host and hostee SDKs: handshake, presentation, capability, control plane
- [Nexus](/docs/libraries/nexus/architecture) — the session protocol: origin filtering, security policy, contract validation, transport security
- [Network Protocol](/docs/libraries/network-protocol) — the envelope the transport can carry
- [Cryptography](/docs/libraries/cryptography) — the primitives beneath the envelope
- [Immutable-Api](/docs/libraries/utils/immutable-api) — locked API surfaces and early-captured built-in copies
- [Architecture Overview](/architecture) — how the layers compose
