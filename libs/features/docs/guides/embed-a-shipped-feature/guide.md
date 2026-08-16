# Embed a feature someone else shipped

Another team shipped their app as a feature package, and you need it running inside your page, alive and observable, without learning their stack. What they handed you is a generated shell: a small npm package carrying the feature's contract, its display modes, and its security pin, with no install-time dependencies of its own.

The worked example is the [demo gallery](/demos) on this site, a Next.js host embedding a Vue clock that is deployed and running somewhere else.

## Install the shell

A shell installs like any package, from a registry or from a tarball the team sent you. Nothing past this point differs between the two routes. The gallery uses tarballs committed under [`apps/docs-site/vendor/`](https://github.com/AndrewRedican/hyperfrontend/tree/main/apps/docs-site/vendor):

```bash
npm install file:vendor/hyperfrontend-demo-clock-shell-0.3.0.tgz
```

## Import it in browser-only code

A shell mounts an iframe and runs a live message channel, so it never runs on the server. In Next.js, keep the imports in a `'use client'` file and create the shell inside an effect, once the container element exists.

<!-- snippet: import-shells -->

Every generated shell exports `createFeatureShell`, so hosting several means aliasing at the import.

## Decide what "alive" means

An iframe that loaded is not a feature that works. Record, per feature, how to create its shell, which contract events prove it is rendering, and how much silence to tolerate before writing the session off:

<!-- snippet: clock-wiring -->

Proof events come from the feature's contract, so ask the team which event fires soonest and what silence means for their app: the budget tracks that feature's rhythm, and the koi pond, quiet until something disturbs the water, gets thirty seconds in the same record.

## Open it and watch for life

Create the shell against a container element, subscribe, then `open()`. Opening is asynchronous: `isOpen` stays false and sends queue until the wire handshake completes, so everything you learn about the session arrives through `on`.

Arm the degradation path first, as one re-arming timer:

<!-- snippet: silence-deadline -->

`apply` is your own state setter, deciding whether the visitor sees `connecting`, `live`, or `offline`.

<!-- snippet: open-and-observe -->

(`isRecord` narrows an unknown payload to a record.) The `open-timeout` error is the shell giving up on the handshake after ten seconds by default, and it has already torn the mount down by the time you hear about it.

Render your fallback under the iframe and reveal the frame on the first proof event: a dead origin then shows your artwork instead of a browser error page, and the fallback is already in place when the deadline fires.

<!-- TODO(asset): short capture of the clock card on /demos crossfading from fallback art to the live embed as the first tick arrives -->

## Close politely

End the session when the component unmounts:

<!-- snippet: teardown -->

`destroy()` closes the channel and releases the DOM, which is the right call when the container is going away with it. Use `close()` when the feature deserves a say first: it gets a closing window to flush, and unsaved work it declared through dirty state is visible to you before the channel drops. (`detachEffects` and `notifyShell` above are the gallery's own bookkeeping, not SDK calls.)

## Check it worked

Open [/demos](/demos): the clock card crossfades from artwork into the live Vue app when the first `tick` lands. To rehearse the failure path, point the shell's `url` at any page that is not a feature, and watch the handshake time out, the deadline fire, and your fallback hold the space.

## The protocol pin is advisory

The clock's shell pins security protocol v1, but that pin is a request, not a guarantee: if the counterpart omits the protocol the session quietly falls back to plaintext, no shell event reports it, the channel's warning is suppressed at the log level a shell runs by default, and nothing fails closed. Own both sides and compare the pins at build or deploy time, because no runtime signal exists to catch the downgrade for you. The [security model](/docs/core-concepts/security) covers what each protocol is worth.

**Related:** [the rest of the handle](/docs/libraries/features/host) · [what the shell wraps](/docs/guides/first-cross-window-connection) · [host and feature roles](/docs/libraries/features/architecture)
