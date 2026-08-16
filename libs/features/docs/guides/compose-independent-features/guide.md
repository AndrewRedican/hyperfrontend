# Compose independently shipped features on one page

Several teams ship separate apps, on different stacks and different deploy schedules, and one page needs all of them working together. Merging the codebases is off the table, and so is a page that goes down because one of the apps did.

Every snippet is extracted from the [koi pond](https://demo-koi-pond-production.up.railway.app/), which composes eight apps in eight frameworks.

## 1. Open one channel per feature

Hold one shell factory per feature. The SDK is pairwise, so N features means N shell packages and N sessions.

<!-- snippet: shell-factories -->

There is no broadcast primitive: anything they all need to hear, you send N times.

## 2. Publish one contract as the shared vocabulary

Put the contract in a library every app installs, and have each app re-export it as its shell-packaging input, so the packaged shell and the running app cannot disagree about the wire.

<!-- snippet: shared-contract -->

Pin the version and track it in every app's `feature.config.ts`. Then leave your highest-cadence actions schema-less and keep a schema on the rest; validation costs per message.

## 3. Mount every feature into a layer you own

Create one absolutely positioned container per feature and mount each session `embedded` into it. Owning the containers is what lets you own the geometry, and a feature never places itself.

<!-- snippet: open-shoal -->

Budget the open timeout for N queued handshakes, not one. Use the `url` override as your deployment seam: it aims baked shell URLs at sub-paths while a single origin serves everything, and per-feature origins mean dropping it.

## 4. Coordinate by relay, not broadcast

Put coordination in the host, the only party that can see every feature. Have features report their own state up on a cadence, aggregate in the host, and answer each feature with the filtered view that feature needs.

<!-- snippet: relay-fanout -->

Narrow the payload yourself on the receiving side of a schema-less hot path.

<!-- snippet: neighbors-handler -->

## 5. Choose security per boundary

Spend protocol v1, the SDK's per-message security envelope, on boundaries that cross trust: separately deployed sites, product meaning in every message.

<!-- snippet: outer-boundary -->

Keep it off high-cadence channels. Under v1 every enveloped message pays a fresh key derivation, and many concurrent chatty channels collapse, dropping messages silently instead of erroring. Where that is your traffic, declare the protocol away and pack the shell with `hf build --ci --allow-open`, which keeps an open channel a decision someone acknowledged rather than a default.

<!-- snippet: fish-config -->

An open channel still pins messages to the configured origin and still runs as a separate document. Compare the pin on both sides at build time: a counterpart that omits the protocol downgrades the session to plaintext and nothing observable reports it.

## 6. Allow the whole ancestor chain

`frame-ancestors` is checked against every ancestor, so a policy naming only the immediate parent blanks the frame one level further out. Set it before you nest any of this; the [pond README](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/koi-pond/README.md) carries a worked three-deep policy set.

## 7. Survive any single feature dying

Scope every reaction to the one feature. Independent sessions share no bundle, no state, and no channel, so one feature's failure domain is one layer of the page.

<!-- snippet: survive-close -->

Retry the open timeout, and only that one: a session that opened and merely went quiet is still someone's live screen.

<!-- snippet: retry-open -->

Keep the composed page behind a cover until every session opens, and lift it on a deadline regardless, so one unreachable app cannot hold the page dark.

<!-- TODO(asset): screen recording of the live pond loading (curtain lifting as the eighth session opens), then devtools request-blocking on /fish-react/ across a reload: seven koi swimming, the React roster row dark, the pond still taking strikes -->

## Check it worked

Load your page and confirm every session opens and reports its connection state. Then kill one: block every request to a single feature's origin in your browser devtools and reload. The cover lifts on its deadline, the remaining features run, the blocked one reports disconnected, and the page still takes input.

The [live pond](https://demo-koi-pond-production.up.railway.app/) is the same rehearsal against eight deployed apps.
