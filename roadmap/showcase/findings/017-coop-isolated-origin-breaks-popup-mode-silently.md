# F-017 — A COOP-isolated feature origin breaks the windowed display modes silently, hanging the host to open-timeout

| Field        | Value           |
| ------------ | --------------- |
| Category     | confusing-error |
| Severity     | medium          |
| Surfaced by  | demo-koi-pond   |
| Status       | open            |
| Disposition  | —               |
| Graduated to | —               |

## What happened

The pond serves `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` so its standalone origin is `crossOriginIsolated` (the inspector card's memory line needs `performance.measureUserAgentSpecificMemory`, which requires it). The feature also declares `popup` in `display.modes`, and the shell bakes a popup mount without complaint — `modes: ["embedded", "dialog", "popup"]` is right there in the vendored shell's `metadata.json`.

Opening that shell with `displayMode: 'popup'` from a host on another origin (the docs-site console's "Open as popup") opens a window that loads and renders the pond perfectly — while the host's session hangs in silence and, ten seconds later, emits `error` with `reason: 'open-timeout'`. The COOP header on the popup's document severs the opener relationship the moment it commits (a browsing-context-group switch), so the handshake can never happen, no matter how long the host waits.

The break is two-way, and the feature side is the more complete half. In the popup, `window.opener` is `null`, so the hostee's peer resolution finds nothing and the feature never attempts a handshake at all: it concludes it is running top-level, reports `hosted: false`, and runs standalone. That is why the popup renders perfectly. It is not a broken feature. It is a feature that correctly worked out that nobody is hosting it. Meanwhile the host's `postMessage` calls into the severed proxy keep succeeding without throwing, and go nowhere.

## Why it's friction (consumer lens)

Two features the SDK encourages — declaring every presentation the feature supports, and serving isolation headers so the feature can measure itself — combine into a silent contradiction. Nothing warns at build time that the declared mode is unreachable from every cross-origin host, and nothing at open time names the cause: `open-timeout` points at the network or a feature that is down, when the actual culprit is one response header on my own origin. I only found it by suspecting the header.

Nothing in the SDK or the docs mentions cross-origin isolation at all, so there is no page where a reader could have met this before hitting it.

The contradiction is conditional, and the condition is the pairing rather than the header alone. `crossOriginIsolated` requires COOP `same-origin` exactly, and a window onto such an origin keeps its opener only when the opener is same-origin **and** itself isolated. Measured across four pairings: same-origin with both sides isolated survives, in `popup` and `standalone` alike; same-origin with a non-isolated opener is severed; cross-origin is severed even when both sides are isolated. So an isolated feature can serve the windowed modes to same-origin isolated hosts, and to nobody else — which for a feature published to third-party origins means nobody at all. `same-origin-allow-popups` does not widen it: that value governs popups the document _opens_, not the opener relationship it keeps when it _is_ opened.

The platform hands the SDK a usable signal it currently ignores: after the COOP switch, the opener's `WindowProxy` for the popup reports `closed: true` even though the window is visibly open.

## Scope

Wider than the title's `popup`. `popup` and `standalone` share `openExternalWindow`, so both fail identically, and every shipped demo is exposed:

| Demo      | Declared modes                              | Serves COOP `same-origin` |
| --------- | ------------------------------------------- | ------------------------- |
| clock     | `embedded`, `dialog`, `popup`, `standalone` | yes                       |
| heartbeat | `embedded`, `dialog`, `popup`, `standalone` | yes                       |
| koi pond  | `embedded`, `dialog`, `popup`               | yes                       |

The iframe modes (`embedded`, `dialog`) are unaffected: COOP governs top-level browsing contexts, not nested ones.

## Proposed fix / improvement

- After `window.open` succeeds, watch the proxy for the whole handshake window; a popup whose proxy reports `closed` while the handshake is still pending should fail fast with a distinct structured reason instead of running out the open-timeout clock. Two constraints the measurements below impose: the watch cannot be brief (the flip is bound to document commit, which on a cold cross-region origin is seconds, not the tens of milliseconds seen on localhost), and the reason cannot name COOP as the cause (a severed proxy is indistinguishable from a window the user closed, so the shell can only report what it observed, and let the elapsed time discriminate).
- Document that `Cross-Origin-Opener-Policy: same-origin` on the feature origin is incompatible with `popup` and `standalone` from cross-origin hosts. This is new material, not a caveat on existing isolation guidance: there is none to append to.

## Repro / evidence

Serve any feature with `Cross-Origin-Opener-Policy: same-origin` (one line in its `hf-serve.config.json`), declare `popup` in its `display.modes`, and open it as a popup from a host on a different origin. The popup renders; the host hangs to `open-timeout`. Live pairing: the deployed koi pond origin opened from the docs-site demo console.

Reduced to two localhost origins in headless Chromium (host on one port, feature with the isolation headers on another), measured directly:

- **Control, no headers:** popup's `window.opener` resolves, the host's handshake message arrives, the feature's reply arrives, `closed` stays `false` throughout.
- **With COOP + COEP:** popup reports `crossOriginIsolated: true` and `window.opener === null`; no message crosses in either direction; the opener's proxy reads `closed: false` at 34 ms and `closed: true` at 54 ms, i.e. about 20 ms after the document commits.
- **Attribution is impossible from the proxy.** A COOP-severed proxy and a proxy for a window the user closed read identically on every cross-origin-accessible property (`closed`, `length`, `opener`, `top`, `parent`, `self`, `window`, `frames`, `location`, own-key count), and `postMessage` silently succeeds on both. The only signal separating them is how soon the flip happened.

Four pairings, to establish exactly where the break falls:

| Opener       | Feature      | Both isolated       | Opener survives                         |
| ------------ | ------------ | ------------------- | --------------------------------------- |
| same origin  | isolated     | yes                 | **yes** (`popup` and `standalone` both) |
| same origin  | isolated     | opener not isolated | no                                      |
| cross origin | isolated     | yes                 | no                                      |
| cross origin | not isolated | n/a                 | yes                                     |
