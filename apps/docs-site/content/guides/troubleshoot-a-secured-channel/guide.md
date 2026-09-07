# Troubleshooting a secured channel

You will match what a secured channel is showing you to what the envelope is doing, and make the one change that resolves it. Each section starts from the symptom as your app sees it.

Every symptom that traces back to the `v1` or `v2` envelope has the same resolution, which is the [migration guide](/docs/guides/migrate-from-v1-and-v2-to-v3-and-v4); this guide names the cause and points there rather than repeating the steps.

## Messages go missing as you add channels

One feature delivers everything; with several open at once, a growing share of what each side sends never arrives, `isOpen` stays true, and nothing is reported. Sampling longer makes the share worse, so the messages are lost rather than late.

This is the `v1` and `v2` envelope under concurrent load. Both derived a fresh key for every message from a random salt, which costs a password-hardening derivation per message on each side, and every channel on the page draws that work from the one crypto pool the browser provides. Channels therefore shared one budget, a message that waited too long in the queue could no longer be opened, and the envelope discarded it without an event.

`v3` and `v4` key a session once, so a message costs one authenticated-encryption operation and never waits on a derivation, and every frame the envelope rejects reaches your app as an [`error`](/docs/libraries/features/host#api-ShellHandle) with `reason: 'security-error'`. Move both sides per the migration guide; once there, a channel that still loses messages has a cause the error code will name (see [A `security-error` code you did not expect](#a-security-error-code-you-did-not-expect)).

## A refusal with `security-unavailable` after upgrading one side

The handshake ends in an `error` with `reason: 'security-unavailable'` on the host and a rejected `ready()` on the feature, as soon as one side is deployed on a current release.

The two sides hold no protocol in common. A side on `v1` or `v2` advertises identifiers a `v3` or `v4` side does not have, the negotiation settles on plaintext, and a [fail-closed](/docs/libraries/nexus#api-ChannelSecuritySettings-prop-mode) session refuses plaintext by design. Deploy the other side in the same release (migration guide, step 1).

The same refusal with both sides current means the pins differ: one side asks for `v3` and the other for `v4`. Pin the same [protocol](/docs/libraries/features/host#api-SecurityProtocol) on both (step 2).

## `authentication-failed`, then `security-unconfirmed`, then `close`

The channel opens, an `error` with `reason: 'security-error'` and `code: 'authentication-failed'` fires, and within the connect timeout (ten seconds by default) a second one with `code: 'security-unconfirmed'` fires and the channel closes.

The two sides derived different keys, which on `v4` means different `sharedKey` values. Each side sealed its confirmation under its own keys, neither could open the other's, and a session in which nothing authenticates is ended rather than kept. Check that both sides read the same key from the same source, including per-environment overrides, and that neither side trims or re-encodes it. Generate the key once and copy it (step 3).

## `createShell` or `createFeature` throws about the shared key

The call throws before any channel exists, with one of two messages: the `v4` protocol requires a pre-shared key of at least 16 characters, or the selected protocol takes no pre-shared key.

The check runs in your frame on purpose, so the misconfiguration is yours to see rather than the counterpart's. For `v4`, supply a [`sharedKey`](/docs/libraries/features/host#api-ShellOptions-prop-sharedKey) that satisfies [`isValidSharedKey`](/docs/libraries/network-protocol/browser/v4#api-isValidSharedKey); for `v3` or `none`, remove the key (step 3).

## `hf build` rejects the protocol

`hf build` exits with `Invalid protocol: "v1" (expected none, v3, or v4)`, or asks for `--protocol v3` or `--protocol v4` when the config carries no pin at all.

The build bakes the pin into the shell and only produces shells for protocols the SDK can negotiate. Rename the pin in `feature.config.ts` or on the command line (step 2) and rebuild (step 4).

## A module or bundle path no longer resolves

An import of `@hyperfrontend/network-protocol/browser/v1` or `/v2` fails to resolve, a script tag for `bundle/v1` or `bundle/v2` returns 404, or `HyperfrontendNetworkProtocolV1` is undefined.

The entries are `/browser/v3`, `/browser/v4`, and their `/node` twins; the bundles are `bundle/v3` and `bundle/v4` with globals `HyperfrontendNetworkProtocolV3` and `HyperfrontendNetworkProtocolV4`; the CDN default points at `v4`. Step 6 covers the call-site changes that go with the import.

## A `security-error` code you did not expect

Every `security-error` carries a [`SecurityErrorCode`](/docs/libraries/nexus#api-SecurityErrorCode). The session continues after each of these except `security-unconfirmed`; a dropped frame is reported, not resent, so your app decides whether to send again.

| Code                    | What happened                                                                            | What to do                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `authentication-failed` | A frame did not open under the session keys                                              | Different keys on the two sides (see above), or a frame from another session of the same windows        |
| `replayed`              | A frame's counter was not above the last accepted one                                    | Something re-posted a frame, or a transport of your own delivers out of order; frames must stay ordered |
| `hello-rejected`        | A hello arrived that differs from the one keying the session                             | A third script is posting hellos to the window, or a reloaded counterpart's old frames still arrive     |
| `unsupported-version`   | A frame carried another protocol's version byte                                          | The two sides pin different protocols; align them                                                       |
| `malformed`             | A frame authenticated but carried no valid packet, or was shorter than a frame can be    | A sender of your own builds frames by hand; use the channel                                             |
| `counter-exhausted`     | The session sealed every frame it can number                                             | Open a new session; this takes more than 2^53 frames                                                    |
| `invalid-session`       | The session could not be keyed from its material, or was negotiated for another protocol | A provider registered under the wrong protocol id; register `v4`'s provider as `v4`                     |
| `security-unconfirmed`  | Nothing authenticated within the connect timeout; the channel closes                     | Key mismatch (see above) or a counterpart whose provider cannot serve the session                       |
| `transport-error`       | The pipeline itself failed, with the cause attached                                      | Read `cause`                                                                                            |

## The mount disappears at once instead of timing out

The host destroys the mount, or the feature's `ready()` rejects, immediately rather than after the open timeout, with an `error` whose `reason` is a [`DenyReason`](/docs/libraries/nexus#api-DenyReason) or `handshake-cancelled`.

This is a refusal, not a timeout: the counterpart denied the handshake at one of its gates (contract, policy, version, or fail-closed security), or cancelled its own attempt. The `reason` names the gate; `security-unavailable` is covered above, and the others mean the two sides disagree on the contract or a policy rejected the origin.

## The first message on a keyed channel is slow

On `v4` the first message after `open` takes a noticeable fraction of a second longer than the ones that follow, and the delay repeats on every new session.

That is the key stretch: the shared key is stretched once per session at 600,000 PBKDF2 iterations before the first frame is sealed, and never again for that session. Keep sessions long-lived rather than reopening the channel per interaction.

## You aligned clocks to keep the envelope working

Some setups synchronised the host and feature clocks, or padded a time window, because the `v1` and `v2` envelope keyed itself to the current minute and rejected frames that crossed a boundary. `v3` and `v4` key a session from values exchanged over the wire and check nothing against the clock, so that alignment carries no weight on the channel and can be retired once both sides have moved.
