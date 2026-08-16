# Compose independently shipped features on one page

Several teams ship separate apps, on different stacks and different deploy schedules, and one page needs all of them working together. Merging the codebases is off the table, and so is a page that goes down because one of the apps did.

The features SDK gives you one host and one feature per channel. This guide is about what changes when there are eight. The worked implementation is the [koi pond](https://demo-koi-pond-production.up.railway.app/): eight koi, each a separate application in a separate framework (React, Vue, Svelte, Solid, Preact, Lit, Angular, vanilla TS), each packaged and deployed as its own feature, composited into one continuous scene by a vanilla-TS host that owns the water, the pointer, and the eight channels. The same pond runs embedded in the [demo gallery](/demos).

Nothing in the pattern is fish-shaped. Swap "koi" for "order panel" and "outline" for "selection changed" and the same five decisions fall out: one channel per feature, one shared contract, mounting into host-owned layers, coordination by host relay, and a security choice per boundary. The sections below take them in that order, then show why the page survives a death.

## Before you start

[Embed a feature someone else shipped](/docs/guides/embed-a-shipped-feature) is the single-feature recipe; everything there (installing a shell package, proving life, closing politely) is assumed here and unchanged. Both sides run the published `@hyperfrontend/features`, and every feature has been packed into a generated shell with `hf build`. The pond vendors its eight shells as `file:` tarballs, the same workflow the gallery guide walks.

## One channel per feature

The SDK is strictly pairwise. A shell is one session between one host and one feature; there is no broadcast primitive and no bus. A page composing eight features therefore holds eight shell packages and runs eight independent sessions:

<!-- snippet: shell-factories -->

Each factory wraps a different shell package's `createFeatureShell`, aliased at import (the import block at the top of [koi-sessions.ts](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/host/src/scene/koi-sessions.ts) names all eight packages). It looks like ceremony next to a loop over one generic shell, and the ceremony is the point: each shell bakes its own feature's contract, URL, display modes, and protocol pin, so the host installs eight typed commitments rather than eight strings. When the host has something to tell everyone, it loops and sends eight times. You will see that fan-out below; it is deliberate, not a missing feature.

## Share one contract as the vocabulary

Coordination needs a language before it needs a mechanism. All eight fish speak the same contract: one versioned object that lives in a small shared library and reaches each app as an installed package. Each app re-exports it as its shell-packaging input, which is what makes the packaged shell and the running app incapable of disagreeing about the wire:

<!-- snippet: shared-contract -->

The [contract itself](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/lib/src/contract/koi-fish.contract.ts) is plain data: the host announces the world, an identity, relayed neighbours, disturbances, and depth grants; a fish answers with its outline, depth and ripple requests, and a settled signal. Two of its decisions travel well beyond this demo. The version is pinned and every app's `feature.config.ts` tracks it, so a contract bump is a coordinated, visible event across the fleet instead of a silent drift. And the two high-cadence actions (`outline` and `neighbors`) deliberately carry no payload schema: eight fish reporting ten times a second is the one place per-message validation cost shows, so the hot path skips it while every low-cadence action keeps its schema and its boundary checks.

On the app side, binding the vocabulary is ordinary hostee code: `createFeature` from `@hyperfrontend/features/hostee` with the shared object as its contract ([fish source](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/fish-vanilla/src/hyperfrontend.feature.ts)). Eight frameworks, one wire format.

## Mount them into layers you own

The host creates one absolutely positioned container per feature and mounts every session `embedded` into it. Owning the containers is what lets the host own the geometry: in the pond, stacking order literally is the depth model, and a koi passing above a neighbour is the host raising that koi's layer in z-index. A feature never gets to place itself.

<!-- snippet: open-shoal -->

Two lines deserve their own paragraph. `openTimeoutMs` is raised to twenty seconds because eight app loads and eight handshakes queue behind one another on a cold load; the SDK's ten-second default is generous for one feature and times out the last of a queue of eight on a slow device. Budget the open timeout for the whole convoy, not the single crossing. The `url` override is the pond's deployment seam: today one origin serves the host at `/` and every fish under `/fish-<name>/`, so the shells' baked cross-origin URLs are overridden with sub-paths. Provisioning eight origins and flipping that one flag is the entire migration to separate deployments.

## Coordinate by relay, not broadcast

Each fish reports its own outline roughly ten times a second and knows nothing about the others. The host is the only party that can see the whole shoal, so the host is where coordination lives. Every 120 milliseconds it answers each fish with that fish's own filtered view of the world:

<!-- snippet: relay-fanout -->

`neighborsFor` ([relay.ts](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/host/src/scene/relay.ts)) broad-phase filters the shoal to what is within reach, dead-reckons stale reports forward along their reported headings, and sorts nearest first. Those mechanics are the demo's own; the shape underneath is the pattern: features report state up, the host aggregates, and the host relays each feature only what it needs. Every fish gets a different answer, which no broadcast could express anyway. And because no feature ever addresses another, a dead fish cannot wedge a conversation between two living ones.

The receiving side of a schema-less hot path has one obligation: narrow it yourself. The SDK validated nothing here, so the fish treats a malformed relay as an empty one instead of letting it crash the frame:

<!-- snippet: neighbors-handler -->

## Choose security per boundary

The composition has two kinds of boundary, and the pond makes a different, explicit choice at each.

The gallery-to-pond channel is a real trust boundary: two separately deployed sites, low traffic, product meaning in every message. It keeps protocol v1, the SDK's per-message security envelope:

<!-- snippet: outer-boundary -->

The eight pond-to-fish channels do not, and this is the ceiling to know about before you design a high-frequency composition. Under protocol v1 every enveloped message pays a fresh key derivation. One chatty channel absorbs that cost; many concurrent high-cadence channels do not, and the failure is the worst kind: throughput collapses and messages drop silently rather than erroring. Eight fish streaming outlines at ten reports a second is exactly that traffic, so each fish declares the protocol away in its config, and its shell is packed with `hf build --ci --allow-open` so an open channel is always a decision someone acknowledged, never a default:

<!-- snippet: fish-config -->

Be precise about what each choice buys. The open channels still pin messages to the configured origin, and the frames are still separate documents with the browser's ordinary isolation between them; what they give up is the cryptographic envelope per message. The v1 pin on the outer channel, meanwhile, is advisory: a counterpart that omits the protocol downgrades the session to plaintext, there is no fail-closed mode today, and nothing observable tells you it happened (no shell event, and the channel layer's warning is below the log level a shell runs at). Treat the pin as a build-time contract you verify on both sides, not a runtime guarantee. The working rule the pond follows: spend the envelope on the boundary that actually crosses trust, keep high-frequency cooperative channels open while the per-message cost stands, and write the reason into the config where the next reader will trip over it. The [security model](/docs/core-concepts/security) covers what v1 actually protects.

## Survive any single feature dying

Independence is not a slogan here; it is the absence of shared anything. The eight sessions share no bundle, no state, and no channel, so the failure domain of one feature is exactly one layer of the page. When a koi's session closes, the host forgets that one fish and touches nothing else:

<!-- snippet: survive-close -->

Every line is scoped to the one framework: its outline leaves the relay so the others stop steering around a ghost, its roster row goes dark, and the shoal count drops by one. The other seven sessions never hear about it.

A feature that never arrives is the open-time version of the same problem. A timed-out handshake leaves a destroyed mount and the SDK does not retry on its own, so the pond retries the timeout itself, and only the timeout; a session that opened and merely went quiet is still someone's live screen and must not be torn down under them:

<!-- snippet: retry-open -->

The curtain in that handler is the pond's loading veil: frames stay hidden until every session opens, and a deadline lifts it anyway so one unreachable app cannot hold the whole page dark.

One more layer, because the composed page is itself a feature of the docs site: the pond reports its own liveness upward. A calm pond is a silent pond, and its embedder would read thirty silent seconds as an outage, so the host re-sends its shoal roll call every ten seconds through the same contract event a real change would use:

<!-- snippet: shoal-pulse -->

That completes the liveness stack for a composition. The SDK's per-session heartbeat tells the pond each frame is running ([Detect and handle an unresponsive feature](/docs/guides/detect-unresponsive-feature) is that layer); the roll call tells the pond's own host that the composition as a whole is alive; and each host judges only the layer it can see.

<!-- TODO(asset): screen recording of the live pond loading (curtain lifting as the eighth session opens), then devtools request-blocking on /fish-react/ across a reload: seven koi swimming, the React roster row dark, the pond still taking strikes -->

## Check it worked

Open the [live pond](https://demo-koi-pond-production.up.railway.app/). The curtain lifts when the eighth session opens, and the roster lists all eight apps with their connection state. Then kill one: in your browser devtools, block every request to `/fish-react/` (network request blocking) and reload. The curtain lifts on its deadline, seven koi swim, React's roster row stays disconnected, and the pond keeps taking pointer strikes as if nothing happened, because for the other seven nothing did. The [gallery embed](/demos) shows the outer layer of the same story: the whole pond as a single feature inside another host.

## The limits, honestly

- Fan-out is the host's cost. With no broadcast primitive, every cadence tick is N sends and every coordination pass is host CPU. At eight features this is nothing, but the pattern puts the scaling bill on the host by design.
- Independence is paid in bytes. Each fish bundles its own renderer (about 180 kB gzipped of three.js, eight times over); a shared chunk would need a shared origin and reintroduce the coupling being removed. The curtain exists partly to cover that load.
- The v1 throughput ceiling and the advisory protocol pin are the two facts most likely to surprise you in production. Design boundaries around them now: neither failure announces itself at runtime.
- Nested framing needs the whole ancestor chain allowed. `frame-ancestors` is checked against every ancestor, and the live chain here is three deep (docs site, pond, koi); a koi policy naming only the pond blanks the whole shoal inside the gallery. The [pond README](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/README.md) documents the exact policy set.

## Where to go next

- The single-feature mechanics this guide assumed: [Embed a feature someone else shipped](/docs/guides/embed-a-shipped-feature).
- The per-session liveness layer under the roll call: [Detect and handle an unresponsive feature](/docs/guides/detect-unresponsive-feature).
- The full shell and hostee surfaces: [features reference](/docs/libraries/features), including the [host SDK](/docs/libraries/features/host).
- Why hosts own geometry and presentation: [features architecture](/docs/libraries/features/architecture). The channel model under all of it: [nexus architecture](/docs/libraries/nexus/architecture).
- The demo end to end, camera contract and depth model included: [koi pond README](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/README.md).
