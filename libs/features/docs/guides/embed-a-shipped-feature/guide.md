# Embed a feature someone else shipped

Another team shipped their app as a feature package, and you need it running inside your page, alive and observable, without learning their stack. What they handed you is a generated shell: a small npm package that carries the feature's contract, its display modes, and its security pin, and asks nothing about your framework in return.

This recipe is the one the docs site itself follows. The [demo gallery](/demos) is a production Next.js host embedding three independently deployed features (a Vue clock, a React heartbeat, an eight-framework koi pond) through their shell packages. The running example is the clock, deployed at [demo-clock-production.up.railway.app](https://demo-clock-production.up.railway.app/) and embedded cross-site into this site.

## Install the shell

A shell package is `hf build` output from the feature team's side: self-contained, zero install-time dependencies, nothing extra to add. If the team publishes it to a registry, `npm install` it like anything else. A registry is optional, though. The gallery installs its three shells from tarballs committed under [`apps/docs-site/vendor/`](https://github.com/AndrewRedican/hyperfrontend/tree/main/apps/docs-site/vendor), which is the "they sent us a build" workflow:

```bash
npm install file:vendor/hyperfrontend-demo-clock-shell-0.3.0.tgz
```

That records a `file:` dependency in [`package.json`](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/docs-site/package.json) exactly as the gallery ships it. Nothing after this point differs between the two install routes.

## Keep it in the browser

A shell mounts an iframe and runs a live message channel, so it is browser-only code. In Next.js that means client components: the gallery's whole integration seam is one `'use client'` file that imports all three shells.

<!-- snippet: import-shells -->

Every generated shell exports `createFeatureShell`, so hosting several means aliasing at the import. Keep these imports out of anything that runs on the server, and create the shell inside an effect, once the container element exists.

## One handle for any stack

Each shell is typed to its own contract, and when you host a single feature those generated types are what you want: `send` and `on` narrowed to the feature's actual action names. The gallery hosts three contracts at once, so it drives every shell through one structural surface:

<!-- snippet: shell-surface -->

This is not an interface the gallery invented; it is the generated handle's shape minus the per-contract typing. The full surface (display modes, sizing, sandboxing, request/response) is reference material in the [host SDK docs](/docs/libraries/features/host). This guide needs only `open`, `on`, `close`, and `destroy`.

## Decide what "alive" means

An iframe that loaded is not a feature that works. The gallery pins down liveness per demo with three facts: how to create the shell, which contract events prove the app is actually rendering, and how much silence to tolerate before writing the session off. This is the clock's entry in a slug-keyed wiring record:

<!-- snippet: clock-wiring -->

The `url` passed to `createShell` comes from a small manifest ([`demo-manifest.ts`](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/docs-site/src/lib/demo-manifest.ts)), which lets a dev environment point the same wiring at a local `hf dev` server instead of the deployed origin. Proof events come from the feature's contract, documented in the shell package and the feature's [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/clock/README.md): the clock streams `tick` once a second from the moment the session opens, so the first `tick` proves the app rendered.

The silence budget is a judgment about the feature's rhythm, not a universal constant. Six quiet seconds from a clock that ticks every second means something is wrong; the koi pond is quiet while nothing disturbs the water, so its entry in the same record tolerates thirty. Ask the feature team what silence means for their app.

## Open it and watch for life

Mounting is: create the shell against a container element, subscribe before opening, then `open()`. Opening is asynchronous. `isOpen` stays false and sends queue until the wire handshake completes, and everything you learn about the session arrives through `on`.

The degradation path comes first, and it is one re-arming timer:

<!-- snippet: silence-deadline -->

`apply` sets the embed's status, plain React state that decides what the visitor sees: `connecting`, `live`, or `offline`. Because every sign of life pushes the deadline out, this one timer covers both failure shapes: a feature that never connects and a feature that dies mid-session.

Then the session itself, in the same effect:

<!-- snippet: open-and-observe -->

(`isRecord` is a two-line type guard narrowing an unknown payload to a record.) Four subscriptions, each with a reason:

- A proof event re-arms the deadline and marks the embed live. Proof events are post-open product traffic, so revealing the iframe on the first one means the visitor never sees a blank frame.
- `status` is the SDK's heartbeat watchdog reporting on the session. `healthy` re-arms the deadline; `gone` demotes immediately. The gallery deliberately ignores `suspect`: a session whose product traffic still flows is visibly alive, and demoting on suspicion makes the embed blink out between ticks.
- `close` mid-session usually means the feature reloaded (a redeploy, an in-frame refresh). The SDK re-adopts the new document and the proof events return, so the honest report is `connecting`, not `offline`.
- `error` with `reason: 'open-timeout'` is the shell giving up on the handshake, ten seconds by default; the shell has already torn its mount down when this fires.

Under all of this the gallery renders a themed fallback card below the invisible iframe and crossfades the frame in on the first proof event. A dead origin therefore shows calm artwork, never a browser error page, and when the silence deadline fires the card is already there. No retry loop, no error UI. The full mounting component is [`demo-embed.tsx`](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/docs-site/src/components/demos/demo-embed.tsx).

<!-- TODO(asset): short capture of the clock card on /demos crossfading from fallback art to the live embed as the first tick arrives -->

## Close politely

When the component unmounts, end the session:

<!-- snippet: teardown -->

`destroy()` closes the channel and releases the DOM, the right call when the container is going away with it. When the feature deserves a say first, use `close()` instead: the feature gets a closing window to flush, and unsaved work it declared through dirty state is visible to you before the channel drops (the clock reports armed alarms this way). Two of the lines above are gallery bookkeeping: `detachEffects` removes host-drawn overlay sprites and `notifyShell` clears a parent's reference to the handle.

## Check it worked

Open [/demos](/demos) and watch the clock card: the artwork crossfades into the live Vue app when the first `tick` lands. Your own host proves itself the same way; the proof event fires and your indicator flips. To rehearse the degradation path without breaking anything, point the shell's `url` at any page that is not a feature: the handshake times out, the deadline fires, and your fallback holds the space.

## The caveat: the protocol pin is advisory

The clock's shell pins security protocol v1, so product traffic normally crosses the boundary enveloped. The pin is advisory. A counterpart that omits the protocol downgrades the session to plaintext, and the only signal is a console warning; there is no fail-closed mode on a shell today, so a downgrade never blocks the connection. If the envelope matters to your integration, treat that warning as a test failure, and read the [security model](/docs/core-concepts/security) for what each protocol is worth and which guarantees stay yours.

## Where to go next

- What the shell wraps: [Your first cross-window connection](/docs/guides/first-cross-window-connection) builds the underlying contract-checked channel by hand.
- The rest of the handle, display modes, sizing, sandbox and permissions delegation: [host SDK reference](/docs/libraries/features/host) and the wider [features reference](/docs/libraries/features).
- Why hosts own geometry and features own state: [features architecture](/docs/libraries/features/architecture).
