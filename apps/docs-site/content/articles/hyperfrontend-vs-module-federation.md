---
title: 'HyperFrontend vs. Module Federation: Two Very Different Answers to the Same Microfrontend Problem'
description: 'Both let teams ship independently and compose at runtime. The resemblance mostly ends there.'
date: '2026-08-24'
author: 'Andrew Redican'
readingTime: '9 min read'
heroImage: '/articles/hyperfrontend-vs-module-federation/hero.webp'
category: 'comparison'
tags: 'module federation, microfrontends, architecture, iframes, runtime isolation'
packages: '@hyperfrontend/features, @hyperfrontend/nexus'
related: 'microfrontends-from-first-principles'
---

_Both let teams ship independently and compose at runtime. The resemblance mostly ends there._

![HyperFrontend vs. Module Federation: federate code, or federate applications](/articles/hyperfrontend-vs-module-federation/hero.webp)

When people first encounter [HyperFrontend](https://www.hyperfrontend.dev/), the obvious comparison is [Module Federation](https://module-federation.io/).

Both support independently developed frontends. Both compose functionality at runtime. Both can let one team ship without waiting for another. Both can make a React host consume functionality owned elsewhere.

But underneath those similarities, they make almost opposite architectural bets.

**Module Federation asks: _How can independently built code behave as one application?_**

**HyperFrontend asks: _How can independently deployed applications cooperate without becoming one application?_**

That distinction explains almost everything that follows.

![Same goal, different boundary](/articles/hyperfrontend-vs-module-federation/same-goal-different-boundary.webp)

## Module Federation federates code

The original webpack 5 model is elegant.

A build exposes modules. Another build references that remote container. At runtime, the host obtains the remote, initializes its sharing scope, asks for an exposed module, and executes it as part of the running application.

webpack's own description gets to the heart of it: multiple separate builds can form a [**single application**](https://webpack.js.org/concepts/module-federation/).

That last phrase matters.

The deployment boundary survives while the runtime boundary largely does not, by design.

One of Module Federation's most valuable capabilities is actually the opposite of isolation: **dependency sharing**. React, React DOM, a design system, state libraries, or utilities can be negotiated through shared scopes so independently built applications do not necessarily instantiate their own copies.

A federated React component can therefore feel almost indistinguishable from a local one. It can render into the same DOM, participate in the same application conventions, use shared dependencies, and fit naturally into the host's interaction model.

That combination is Module Federation's strength and the source of its architectural trade-off.

Current Module Federation is broader than the original webpack plugin. Its [runtime API](https://module-federation.io/guide/runtime/) supports dynamic registration and loading, [multiple share scopes](https://module-federation.io/guide/advanced/multiple-shared-scope) handle cases such as parallel React ecosystems, and bridge tooling can compose application-shaped remotes across frameworks. The architectural center, however, is still the same: independently built software is brought together inside a shared application runtime.

## HyperFrontend federates applications

HyperFrontend draws the boundary somewhere else.

A feature is a **standalone web application** loaded from its own deployment URL, rather than primarily an exposed JavaScript module.

The host mounts that application in a separate browser context, normally an iframe, and communication crosses the boundary through a protocol built over `postMessage`.

The host's React is not the feature's React. Its globals are not the feature's globals. Its CSS cascade does not wander into the feature. A feature can use a different framework, bundler, dependency graph, release cadence, or application architecture entirely.

The common abstraction is the browser boundary rather than a JavaScript module system.

That boundary is valuable precisely because it preserves separation. As [Microfrontends from First Principles](https://www.hyperfrontend.dev/articles/microfrontends-from-first-principles#what-only-the-iframe-gives-you) puts it, the alternatives generally start from cohesion and carve out independence, while the iframe starts from independence and forces you to earn cohesion back explicitly.

That also tells us where the cost lives.

A separate document means focus, routing, keyboard behavior, theming, sizing, accessibility relationships, and some presentation concerns cannot simply leak across the boundary. Those costs are [real properties of an app-shaped boundary](https://www.hyperfrontend.dev/articles/microfrontends-from-first-principles#the-complaint-list), not evidence that the boundary failed.

If the independence is worth preserving, the integration work is worth paying for. If it is not, [pick a smaller boundary](https://www.hyperfrontend.dev/articles/microfrontends-from-first-principles#when-the-seam-is-app-shaped).

HyperFrontend exists to standardize much of that integration work so every feature does not have to invent its own handshake, contract semantics, liveness model, teardown, presentation coordination, and security rules.

## This is really a cohesion-versus-isolation trade

The distinction is where each architecture begins, and which cost it accepts.

![Where the complexity goes](/articles/hyperfrontend-vs-module-federation/where-complexity-goes.webp)

Module Federation starts from a cohesive runtime and preserves independence around it.

HyperFrontend starts from independent runtimes and rebuilds only the cohesion the product actually needs.

A more accurate version of the trade is therefore:

> **Module Federation accepts recurring coordination to preserve independence inside a cohesive runtime.**  
> **HyperFrontend accepts an integration tax to earn cohesion across an isolated runtime boundary.**

The first tends to surface in dependency policy, share scopes, framework integration, build assumptions, and runtime conventions.

The second tends to surface in contracts, messaging, lifecycle, presentation, and browser-boundary concerns.

HyperFrontend is designed around paying that second tax once in the platform instead of re-solving it independently for every embedded application.

## Dependency management is almost inverted

Consider React.

With Module Federation, sharing React is often desirable. It avoids unnecessary copies, preserves assumptions that depend on a singleton runtime, and keeps the application operating as one React environment where that is what you want.

Modern Module Federation does not require one React version for the entire estate. [Multiple share scopes](https://module-federation.io/guide/advanced/multiple-shared-scope) explicitly support cases such as running two React ecosystems side by side.

But the mechanism still reveals the architectural premise: producers and consumers agree on which scopes exist, which dependencies belong to them, and how those dependencies should be reused.

Coexistence is supported, but coexistence is coordinated.

HyperFrontend takes the opposite position at that layer: **there is no cross-feature JavaScript dependency graph to negotiate**.

If one feature needs React 18 and another needs React 19, each owns its runtime. The same is true for Angular, Vue, an old jQuery application, or something with no framework at all.

That can mean more runtime memory and startup work, especially when many feature documents are active at once. Browser caching may avoid retransferring identical static assets, but cached bytes are not a shared live JavaScript instance.

The extra runtime memory and startup work is the tax of isolation; the payoff is that one application's dependency decisions do not become another application's release constraint.

## HyperFrontend's interesting part is not really the iframe

A bare iframe plus `postMessage` gives you a document boundary and a transport.

HyperFrontend adds the protocol and integration layer needed to turn that separation into cooperation.

A feature can connect through the feature-side SDK:

```ts
import { createFeature } from '@hyperfrontend/features/hostee'
import contract from '../clock.contract'

export const feature = createFeature({
  name: '@hyperfrontend/demo-clock',
  contract,
  protocol: 'v1',
})

await feature.ready()
```

The important part is what `ready()` represents.

The Nexus layer establishes a session through a `REQUEST → ACCEPT → OPEN` handshake. Each side learns the counterpart's origin and pins it. Contracts can declare required actions and versions, and schema-backed payloads are validated across the boundary.

An iframe finishing `load` is not treated as equivalent to "the application is ready and compatible."

The same applies to liveness and teardown. A peer can be `healthy`, `unobservable`, `suspect`, or `gone`, with page visibility accounted for when interpreting missed heartbeats. Intentional close, reload, disappearance, dirty state, and shutdown are distinct lifecycle events rather than variations of "the iframe changed."

This is the difference between embedding a page and operating an application boundary.

The detailed reasoning behind those boundaries is already covered in [Microfrontends from First Principles](https://www.hyperfrontend.dev/articles/microfrontends-from-first-principles#the-smallest-shared-contract). The important point here is simply that HyperFrontend treats them as first-class protocol concerns instead of leaving each host and feature pair to improvise them.

## Where Module Federation is clearly better

Suppose you run a consumer product where several frontend teams all use React, the same design system, infrastructure you control, and broadly compatible runtime assumptions.

The search team wants to ship:

```tsx
<SearchResults query={query} />
```

The host wants that component to participate naturally in React context, routing, shared application state, theming, responsive layout, accessibility, overlays, and error handling.

This is exactly where Module Federation is strongest.

You get separately built and deployable code without discarding the advantages of one application. The DOM remains one DOM. CSS can work normally. ARIA relationships are not split between documents. A dropdown or popover can escape its component's local box without requiring another browser frame.

A remote can participate in the host's rendering conventions with very little conceptual impedance.

HyperFrontend can coordinate larger presentation modes, including mounting a feature as a full-viewport dialog, but it still treats the browser boundary as real.

You do not get the same effortless component composition, nor should you pay for application-level isolation when the seam is only component-shaped.

For a cohesive product whose teams already share a technology platform and trust boundary, **Module Federation is usually the more natural abstraction.**

## Where HyperFrontend becomes interesting

Now change the organization.

You inherit an estate like this:

```text
Main product          React 19
Billing               Angular 17
Reporting             Vue 3
Admin                 AngularJS
Legacy configurator   jQuery
Partner widget        unknown
Customer extension    not owned by you
```

Module Federation can integrate more of this estate than a webpack-era mental model suggests. React and Vue have bridge tooling, Angular has federation support, and multiple dependency scopes can isolate incompatible runtime families.

The harder requirement is **federation participation**.

They need a federation-capable integration, an exposed module or mount contract, and a way to coexist inside a shared document model.

For applications you own and actively maintain, that can be entirely reasonable.

For inherited systems, independently operated products, old applications, or partner integrations, it can be a much larger change than the product feature itself.

HyperFrontend asks for something different. Each participant remains a deployable web page, integrates the feature SDK, permits the host to embed it, and communicates through a boundary contract.

That is still integration work. A third-party application does not become a HyperFrontend feature merely because you know its URL. It must participate in the handshake and its server must allow the host as an embedding ancestor.

But the parties do not need to align their framework, bundler, dependency versions, router, state container, DOM ownership, or release schedule.

They need to agree on the messages that cross the boundary.

```text
Host → Feature

SET_CUSTOMER
{ id: string }


Feature → Host

INVOICE_SELECTED
{ invoiceId: string }
```

At that point the problem resembles distributed systems design more than component composition.

That is why the vocabulary shifts toward sessions, contracts, compatibility, liveness, and teardown.

## The security model is fundamentally different

There is another consequence of choosing the browser document as the boundary.

A Module Federation remote is remote in where its code came from. Once loaded, that code executes as part of your application environment and should be treated as trusted application code.

HyperFrontend can preserve stronger containment because the feature remains in a separate document.

For cross-origin documents, the browser's **same-origin policy** prevents direct access to the other side's DOM and JavaScript state. HyperFrontend binds the session to the counterpart window and learned origin, validates contracts and messages, and can add transport protection around product traffic.

The browser boundary also has a capability dimension. Origin isolation governs what one document may read from another; iframe `sandbox` and `allow` govern what an embedded document may do. HyperFrontend exposes those controls to the host, while the feature's own server remains responsible for policies such as `Content-Security-Policy: frame-ancestors`.

Embedding a feature remains an act of trust. HyperFrontend's security model focuses on containment: a buggy or compromised feature does not automatically share the host's DOM, globals, CSS cascade, or JavaScript environment, and the host can further restrict browser capabilities.

Legacy systems, separately operated products, plugin-shaped capabilities, acquisitions, and integrations can benefit from that containment when independence is part of the trust model rather than merely an organizational preference.

## So which is "more microfrontend"?

Neither architecture is inherently "more microfrontend"; they optimize different interpretations of independence.

| Dimension                       | Module Federation                                             | HyperFrontend                                                       |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Primary composition unit        | Module, component, or application-level module                | Deployable web application                                          |
| Runtime boundary                | Normally one document and JavaScript environment              | Separate browser document and JavaScript environment                |
| Dependency model                | Optional sharing and negotiated scopes                        | Independent dependency graphs                                       |
| Build integration               | Federation-capable integration required                       | Any deployable web app that can integrate the feature SDK           |
| UI cohesion                     | Excellent                                                     | Explicitly coordinated across the boundary                          |
| Fine-grained components         | Excellent fit                                                 | Poor fit                                                            |
| Application-shaped capabilities | Excellent fit                                                 | Excellent fit                                                       |
| Runtime overhead                | Usually lower; dependencies can be shared                     | Usually higher; application runtimes are independent                |
| Cross-team coordination         | Required where runtime assumptions or dependencies are shared | Concentrated at the contract and product-integration boundary       |
| Legacy/inherited systems        | Good when they can participate in federation                  | Strong when they already exist as independently deployable web apps |
| Failure containment             | Shared application runtime, with framework/bridge fallbacks   | Separate document and session boundary                              |
| Capability containment          | Requires an additional boundary                               | Native iframe controls available to the host                        |

HyperFrontend approaches the problem from a different premise than Module Federation.

Module Federation says:

> **Separate the builds, but preserve one application.**

HyperFrontend says:

> **Keep the applications separate, then earn back exactly the cohesion the product needs.**

For organizations where technological cohesion is cheap, the Module Federation bargain is excellent. You get autonomy at the build and deployment layer without turning every team boundary into a browser boundary.

For organizations where recurring coordination has become the expensive part, HyperFrontend becomes more interesting. The isolated boundary preserves independence first, then the platform standardizes the work required to make those applications cooperate.

That is the choice underneath both architectures.

Not whether runtime composition is good.

Not whether sharing dependencies is good.

Not whether iframes are good.

The question is where you want the system to begin:

**with cohesion, carving out independence, or with independence, earning cohesion back.**

That is also the question behind [Microfrontends from First Principles](https://www.hyperfrontend.dev/articles/microfrontends-from-first-principles#what-only-the-iframe-gives-you), and it is the most useful way to understand why HyperFrontend and Module Federation can solve similar organizational problems while remaining fundamentally different architectures.
