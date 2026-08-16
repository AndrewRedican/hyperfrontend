# Compose independently shipped features on one page

Several teams ship separate apps, on different stacks and different deploy schedules, and one page needs all of them working together. Merging the codebases is off the table, and so is a page that goes down because one of the apps did.

The features SDK gives you one host and one feature per channel. This guide is about what changes when there are eight. The worked implementation is the [koi pond](https://demo-koi-pond-production.up.railway.app/): eight koi, each a separate application in a separate framework (React, Vue, Svelte, Solid, Preact, Lit, Angular, vanilla TS), each packed into its own shell with `hf build`, composited into one continuous scene by a vanilla-TS host. Nothing in the pattern is fish-shaped: swap "koi" for "order panel" and "outline" for "selection changed" and the same five decisions fall out.

## One channel per feature

The SDK is strictly pairwise. A shell is one session between one host and one feature; there is no broadcast primitive and no bus. A page composing eight features therefore holds eight shell packages and runs eight independent sessions:

<!-- snippet: shell-factories -->

Each shell bakes its own feature's contract, URL, display modes, and protocol pin, so the host installs eight typed commitments rather than eight strings. Anything the host wants all of them to hear, it sends eight times.

## Share one contract as the vocabulary

All eight fish speak one versioned contract object, published from a small shared library and installed by every app. Each app re-exports it as its shell-packaging input, so the packaged shell and the running app cannot disagree about the wire:

<!-- snippet: shared-contract -->

Two of that contract's choices travel beyond this demo. The version is pinned and every app's `feature.config.ts` tracks it, so a contract bump is a coordinated, visible event across the fleet rather than a silent drift. And the two high-cadence actions (`outline` and `neighbors`) carry no payload schema on purpose: eight fish reporting ten times a second is where per-message validation cost shows. Every low-cadence action keeps its schema.

## Mount them into layers you own

The host creates one absolutely positioned container per feature and mounts every session `embedded` into it. Owning the containers is what lets the host own the geometry: in the pond, stacking order literally is the depth model, and a koi passing above a neighbour is the host raising that koi's layer in z-index. A feature never gets to place itself.

<!-- snippet: open-shoal -->

Budget the open timeout for the whole convoy, not the single crossing. The `url` override is the deployment seam: it aims the baked shell URLs at sub-paths while one origin serves everything, and giving each feature its own origin means dropping the override.

## Coordinate by relay, not broadcast

Each fish reports its own outline roughly ten times a second and knows nothing about the others. The host is the only party that can see the whole shoal, so the host is where coordination lives. Every 120 milliseconds it answers each fish with that fish's own filtered view of the world:

<!-- snippet: relay-fanout -->

Features report state up, the host aggregates, and the host relays each feature only what it needs (the pond's [relay](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/host/src/scene/relay.ts) trims the shoal to what is within reach and dead-reckons stale reports forward). Every fish gets a different answer, which no broadcast could express anyway. And because no feature ever addresses another, a dead one cannot wedge a conversation between two living ones.

The receiving side of a schema-less hot path has one obligation: narrow it yourself.

<!-- snippet: neighbors-handler -->

## Choose security per boundary

The gallery-to-pond channel is a real trust boundary: two separately deployed sites, low traffic, product meaning in every message. It keeps protocol v1, the SDK's per-message security envelope:

<!-- snippet: outer-boundary -->

The eight pond-to-fish channels do not, and the reason is the ceiling to know before designing a high-frequency composition: under v1 every enveloped message pays a fresh key derivation, so one chatty channel is fine but many concurrent high-cadence channels collapse, dropping messages silently instead of erroring. Eight fish streaming outlines at ten reports a second is exactly that traffic, so each fish declares the protocol away and its shell is packed with `hf build --ci --allow-open`, which keeps an open channel a decision someone acknowledged rather than a default:

<!-- snippet: fish-config -->

An open channel still pins messages to the configured origin and still runs as a separate document with the browser's ordinary isolation; what it gives up is the envelope. The v1 pin is itself advisory: a counterpart that omits the protocol silently downgrades the session to plaintext, there is no fail-closed mode, and nothing observable reports it (no shell event, and the channel layer's warning sits below the log level a shell runs at), so verify the pin on both sides at build time instead of trusting it at runtime. Spend the envelope on the boundary that actually crosses trust.

One header to get right before nesting any of this: `frame-ancestors` is checked against every ancestor, and the live chain here is three deep (docs site, pond, koi), so a koi policy naming only the pond blanks the whole shoal inside the gallery. The [pond README](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/README.md) has the exact policy set.

**Related:** [security model](/docs/core-concepts/security)

## Survive any single feature dying

The eight sessions share no bundle, no state, and no channel, so the failure domain of one feature is exactly one layer of the page. When a koi's session closes, the host forgets that one fish and touches nothing else:

<!-- snippet: survive-close -->

Every line is scoped to the one framework, and the other seven sessions never hear about it.

A feature that never arrives is the open-time version of the same problem, and the pond handles it in the error path:

<!-- snippet: retry-open -->

The curtain there is the pond's loading veil: frames stay hidden until every session opens, and a deadline lifts it anyway so one unreachable app cannot hold the whole page dark.

<!-- TODO(asset): screen recording of the live pond loading (curtain lifting as the eighth session opens), then devtools request-blocking on /fish-react/ across a reload: seven koi swimming, the React roster row dark, the pond still taking strikes -->

## Check it worked

Open the [live pond](https://demo-koi-pond-production.up.railway.app/). The curtain lifts when the eighth session opens, and the roster lists all eight apps with their connection state. Then kill one: in your browser devtools, block every request to `/fish-react/` (network request blocking) and reload. The curtain lifts on its deadline, seven koi swim, React's roster row stays disconnected, and the pond keeps taking pointer strikes, because for the other seven nothing happened. The [gallery embed](/demos) is the outer layer of the same story: the whole pond as a single feature inside another host.
