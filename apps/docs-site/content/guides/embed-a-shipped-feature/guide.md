# Embed a feature someone else shipped

By the end of this guide another team's app runs inside your page, tells you honestly whether it is alive, and degrades to your own fallback when it is not. It takes eight steps and one timer.

That is worth doing because the app is not yours to learn. It arrives as a package, ships on its own schedule, and can be down when your page is up, so the integration is a contract and a liveness judgement rather than a build.

The code examples come from this site's [demo gallery](/demos), a Next.js host embedding a separately deployed Vue clock.

## 1. Install the shell

```bash
npm install file:vendor/hyperfrontend-demo-clock-shell-0.3.0.tgz
```

A registry name installs the same way.

## 2. Keep the import in browser-only code

A shell mounts an [`<iframe>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) and runs a live message channel, so it belongs in code that only ever runs in the browser.

<!-- snippet: import-shells -->

Every generated shell exports [`createFeatureShell`](/docs/libraries/features/architecture#shell-generation), so hosting more than one means aliasing at the import.

## 3. Decide what "alive" means

Record, per feature, how to create its shell, which contract events prove it is rendering, and how much silence to tolerate before writing the session off.

<!-- snippet: clock-wiring -->

Ask the feature's team which event fires soonest and what silence means for their app.

## 4. Arm the degradation path

Arm a single deadline before you open, and push it out on every sign of life.

<!-- snippet: silence-deadline -->

## 5. Open the session and subscribe

Create the shell against a container element, subscribe, then [`open()`](/docs/libraries/features/host#api-ShellHandle). Sends queue until the handshake completes, so everything you learn about the session arrives through `on`.

<!-- snippet: open-and-observe -->

Three calls are yours to make, not the SDK's: ignore [`suspect`](/docs/libraries/features/host#api-HeartbeatState) while product traffic still arrives, report a mid-session `close` as `connecting` rather than `offline`, and treat `error` with `reason: 'open-timeout'` as terminal.

## 6. Reveal the frame on the first proof event

Render your fallback under the iframe and swap to the frame on the first proof event, so a dead origin shows your artwork instead of a browser error page.

<!-- TODO(asset): short capture of the clock card on /demos crossfading from fallback art to the live embed as the first tick arrives -->

## 7. Close politely

<!-- snippet: teardown -->

[`destroy()`](/docs/libraries/features/host#api-ShellHandle) releases the DOM along with the channel. Use `close()` when the feature needs a flush window first.

## 8. Compare the protocol pin on both sides

A shell bakes the [protocol](/docs/libraries/features/host#api-SecurityProtocol) the feature declared in its [`feature.config.ts`](/docs/libraries/features/cli#config-resolution). Compare the two in your build or deploy step: a counterpart that omits the protocol falls back to plaintext, and no runtime signal reports it.

## Check it worked

Your fallback gives way to the live frame on the first proof event. To rehearse the failure path, point the shell's `url` at any page that is not a feature, and watch the handshake time out, the deadline fire, and your fallback hold the space.
