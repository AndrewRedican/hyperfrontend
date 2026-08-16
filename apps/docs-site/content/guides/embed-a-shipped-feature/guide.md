# Embed a feature someone else shipped

Another team's app runs inside your page, tells you honestly whether it is alive, and gives way to your own fallback when it is not.

Their app is not yours to learn. It arrives as a package, ships on its own schedule, and can be down while your page is up, so what you build is a contract and a liveness judgement.

You install one thing: the shell package their build produced with [`@hyperfrontend/features`](/docs/libraries/features), which bundles the host SDK and declares no dependencies of its own. The snippets come from this site's [demo gallery](/demos), a Next.js host embedding a separately deployed Vue clock.

## 1. Install the shell package

```bash
npm install @acme/checkout-feature-shell
```

A tarball the team sent you installs the same way: `npm install file:vendor/acme-checkout-feature-shell-1.0.0.tgz`.

## 2. Keep the import in browser-only code

A shell mounts an [`<iframe>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe) and runs a live message channel, so import it from code that only ever runs in the browser.

<!-- snippet: import-shells -->

Every generated shell exports [`createFeatureShell`](/docs/libraries/features/architecture#shell-generation), so alias at the import when you host more than one.

## 3. Decide what "alive" means

Per feature, record how to create its shell, which contract events prove it is rendering, and how much silence you will tolerate before writing the session off. Ask the feature's team which event fires soonest and what silence means for their app.

<!-- snippet: clock-wiring -->

## 4. Arm the degradation path

One deadline, armed before you open and pushed out on every sign of life.

<!-- snippet: silence-deadline -->

## 5. Open the session and subscribe

Create the shell against a [`container`](/docs/libraries/features/host#api-ShellOptions-prop-container) element, subscribe, then [`open()`](/docs/libraries/features/host#api-ShellHandle). Sends queue until the handshake completes, so everything you learn about the session arrives through `on`.

<!-- snippet: open-and-observe -->

Three calls are yours rather than the SDK's: ignore [`suspect`](/docs/libraries/features/host#api-HeartbeatState) while product traffic still arrives, report a mid-session `close` as connecting rather than offline (it is usually the feature reloading), and treat `error` with [`reason: 'open-timeout'`](/docs/libraries/features/host#api) as terminal.

## 6. Reveal the frame on the first proof event

Render your fallback under the iframe and swap to the frame on the first proof event, so a dead origin shows your artwork instead of a browser error page.

<!-- TODO(asset): short capture of the clock card on /demos crossfading from fallback art to the live embed as the first tick arrives -->

## 7. Close politely

<!-- snippet: teardown -->

[`destroy()`](/docs/libraries/features/host#api-ShellHandle) releases the DOM along with the channel. Use `close()` when the feature needs a flush window first.

## 8. Compare the protocol pin on both sides

A shell bakes the [protocol](/docs/libraries/features/host#api-SecurityProtocol) the feature declared in its [`feature.config.ts`](/docs/libraries/features/cli#config-resolution). Compare the two in your build or deploy step: a counterpart that omits the protocol falls back to plaintext, and no runtime signal reports it.

## Check it worked

Your fallback gives way to the live frame on the first proof event. To rehearse the failure path, point the shell's [`url`](/docs/libraries/features/host#api-ShellOptions-prop-url) at any page that is not a feature, and watch the handshake time out, the deadline fire, and your fallback hold the space.
