# How to migrate from v1 and v2 to v3 and v4

You will move a host and a feature from the `v1` or `v2` envelope to `v3` or `v4` and have them open on a channel keyed once per session, keeping the mode you had: keyless stays keyless, keyed stays keyed.

The current releases of [`@hyperfrontend/features`](/docs/libraries/features) build and negotiate `v3` and `v4` only. The two map one to one onto the modes you already run: `v1` was the envelope without a shared secret, and `v3` is that mode; `v2` was the envelope with a `sharedKey`, and `v4` is that mode. What changes underneath is how the envelope is keyed. Each session agrees fresh keys over the wire, every message costs one authenticated-encryption operation, a frame the envelope rejects is reported to your app, and a counterpart that cannot run the protocol you pinned is refused rather than opened on something else.

The code here is authored for this guide; every snippet is the general form, with your own names where the placeholders are.

## 1. Update both sides together

A side on `v1` or `v2` and a side on `v3` or `v4` hold no protocol in common, so they cannot open a channel: the handshake settles on plaintext, and a [fail-closed](/docs/libraries/nexus#api-ChannelSecuritySettings-prop-mode) session refuses that with [`security-unavailable`](/docs/libraries/nexus#api-DenyReason). Plan the move as one release per host-and-feature pair.

On the feature, update the SDK:

```bash
npm install @hyperfrontend/features@latest
```

On the host, the update arrives with the rebuilt shell in step 4, because a [generated shell](/docs/libraries/features/architecture#shell-generation) bundles the SDK it was built with. A host that calls [`createShell`](/docs/libraries/features/host#api-createShell) from `@hyperfrontend/features/host` directly updates its own dependency the same way.

If you drive [`@hyperfrontend/nexus`](/docs/libraries/nexus) or [`@hyperfrontend/network-protocol`](/docs/libraries/network-protocol) without the SDK, install `@hyperfrontend/nexus@latest` and `@hyperfrontend/network-protocol@latest` on both sides and continue with steps 5 and 6.

## 2. Rename the pin

Change every [`protocol`](/docs/libraries/features/host#api-SecurityProtocol) value: `v1` becomes `v3`, `v2` becomes `v4`. The pin lives in the feature's [`feature.config.ts`](/docs/libraries/features/cli#config-resolution), in any [`createFeature`](/docs/libraries/features/hostee#api-createFeature) or `createShell` call that passes it explicitly, and in any `hf build --protocol` invocation in your scripts.

```ts
// feature.config.ts
import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: '@acme/checkout',
  version: '2.0.0',
  contract: './checkout.contract.ts',
  url: 'https://checkout.example.com/',
  protocol: 'v4',
})
```

A shell built from that config bakes the pin in, so a host embedding the shell passes no `protocol` of its own. A host that calls `createShell` directly passes it:

```ts
import { createShell } from '@hyperfrontend/features/host'

const shell = createShell({
  url: 'https://checkout.example.com/',
  contract,
  protocol: 'v4',
  sharedKey: CHECKOUT_CHANNEL_KEY,
})
```

## 3. Generate the shared key for v4

`v4` binds each session to a [`sharedKey`](/docs/libraries/features/host#api-ShellOptions-prop-sharedKey) that both sides supply. The key must be a string of at least [16 characters](/docs/libraries/network-protocol/browser/v4#api-MIN_SHARED_KEY_LENGTH), and the guarantee holds for a generated value of 128 bits or more, so generate it rather than choosing it:

```bash
node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"
```

Store the 32-character result wherever both sides already read secrets from, and hand it to the host through `sharedKey` and to the feature through the same option on `createFeature`. A key given with `v3` or `none` throws at the call site, so remove `sharedKey` from any pair that stays keyless.

## 4. Rebuild and republish the shell

Build the feature with the new pin and publish the shell it produces:

```bash
npx hf build --ci --protocol v4
```

`hf build` bakes the pin into the shell and refuses `v1` and `v2`. On the host, install the new shell version; the host keeps supplying `sharedKey` and nothing else changes in the embed call. Deploy the feature and the host in the same release, per step 1.

## 5. Update a direct nexus integration

If your host or feature drives a [`createBroker`](/docs/libraries/nexus#api-createBroker) broker itself, register a provider for the protocol you pin and opt each channel in. The [`protocols`](/docs/libraries/nexus#api-SecurityProtocolProviders) bag is keyed by protocol id and takes a [`SecurityProvider`](/docs/libraries/nexus#api-SecurityProvider) built from network-protocol's `createChannel` and `createProtocol`; the shared key belongs to the provider, and the channel settings name the protocol and the mode:

```ts
import { createBroker } from '@hyperfrontend/nexus'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v4'

const broker = createBroker({
  name: 'host',
  contract,
  settings: {
    security: {
      protocols: { v4: { createChannel, protocolProvider: createProtocol(logger, CHECKOUT_CHANNEL_KEY) } },
    },
  },
})

const channel = broker.addChannel('checkout', iframe.contentWindow, {
  security: { protocol: 'v4', mode: 'fail-closed' },
})
```

Delete the [`BrokerSecurityConfig`](/docs/libraries/nexus#api-BrokerSecurityConfig) fields that no longer exist (`protocolLoader`, `defaultProtocol`, `defaultSharedKey`, `defaultRefreshRate`) and the `sharedKey` and `refreshRate` entries from [`ChannelSecuritySettings`](/docs/libraries/nexus#api-ChannelSecuritySettings). Then adjust what you listen for: [`security-ready`](/docs/libraries/nexus#api-SecurityReadyEventData) carries `{ protocol }` and fires once the counterpart's first sealed frame authenticates, [`security-error`](/docs/libraries/nexus#api-SecurityErrorEventData) carries a [`SecurityErrorCode`](/docs/libraries/nexus#api-SecurityErrorCode), and a session that nobody confirms within the connect timeout ends with a `close` whose [reason](/docs/libraries/nexus#api-CloseReason) is `security-unconfirmed`.

## 6. Update a direct network-protocol integration

If you use the wire pipeline on its own, import the protocol from `/browser/v3` or [`/browser/v4`](/docs/libraries/network-protocol/browser/v4) (or the `/node` twins), build the channel with an options object that names the session, and run the hello exchange the session is keyed from:

```ts
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v4'

const channel = createChannel('app-to-widget', {
  send: (frame) => widget.postMessage(frame, widgetOrigin, [frame.buffer]),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(logger, CHECKOUT_CHANNEL_KEY),
  session: {
    protocol: 'v4',
    role: 'initiator',
    localId: appId,
    peerId: widgetId,
  },
  onDrop: (drop) => report(drop.reason, drop.cause),
})

widget.postMessage(await channel.hello(), widgetOrigin)
window.addEventListener('message', ({ data }) => (channel.isHello(data) ? channel.acceptHello(data) : channel.receive(data)))
```

[`createChannel`](/docs/libraries/network-protocol/browser/channel#api-createChannel) takes [`ChannelOptions`](/docs/libraries/network-protocol/browser/channel#api-ChannelOptions) in place of the positional callbacks, the provider receives the session, and sends made before the counterpart's hello arrives wait inside the seal stage. Script-tag consumers load `bundle/v3` or `bundle/v4` and read `HyperfrontendNetworkProtocolV3` or `HyperfrontendNetworkProtocolV4`.

## 7. Handle what the app now observes

Three outcomes reach your handlers that a `v1` or `v2` pair never produced. A refused handshake arrives as an [`error`](/docs/libraries/features/host#api-ShellHandle) with `reason: 'security-unavailable'`, and the host tears the mount down at once while the feature's `ready()` rejects. A frame the envelope rejected, or a session that did not confirm, arrives as an `error` with `reason: 'security-error'` and the code that names the verdict. A counterpart that abandoned the handshake at its own gates arrives on the host as `reason: 'handshake-cancelled'`.

```ts
shell.on('error', (error) => {
  switch (error.reason) {
    case 'security-unavailable':
    case 'handshake-cancelled':
      showUnavailable(error.error)
      break
    case 'security-error':
      report(error.code, error.message)
      break
  }
})
```

Treat `security-unavailable` as a deployment mismatch to fix, not a state to retry: one side pins a protocol the other cannot run, or one side is still on `v1` or `v2`.

## Check it worked

Open the pair with matching pins: `open` fires, product messages flow, and no `error` fires. Now change the key on one side only and open again: an `error` with `reason: 'security-error'` and `code: 'authentication-failed'` fires, and within ten seconds a second one with `code: 'security-unconfirmed'` followed by `close`. Restore the key and pin `v3` on one side and `v4` on the other: `error` fires with `reason: 'security-unavailable'` and the mount is gone before the open timeout would have expired.
