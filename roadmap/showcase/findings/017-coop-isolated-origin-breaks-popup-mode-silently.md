# F-017 — A COOP-isolated feature origin makes popup mode hang to open-timeout with no hint why

| Field        | Value           |
| ------------ | --------------- |
| Category     | confusing-error |
| Severity     | medium          |
| Surfaced by  | demo-koi-pond   |
| Status       | open            |
| Disposition  | —               |
| Graduated to | —               |

## What happened

The pond serves `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` so its standalone origin is `crossOriginIsolated` (the inspector card's memory line needs `performance.measureUserAgentSpecificMemory`, which requires it). The feature also declares `popup` in `display.modes`, and the shell bakes a popup mount without complaint.

Opening that shell with `displayMode: 'popup'` from a host on another origin (the docs-site console's "Open as popup") opens a window that loads and renders the pond perfectly — while the host's session hangs in silence and, twenty seconds later, emits `error` with `reason: 'open-timeout'`. The COOP header on the popup's document severs the opener relationship the moment it loads (a browsing-context-group switch), so the handshake messages can never cross, no matter how long the host waits.

## Why it's friction (consumer lens)

Two features the SDK encourages — declaring every presentation the feature supports, and serving isolation headers so the feature can measure itself — combine into a silent contradiction. Nothing warns at build time that the declared popup mode is unreachable from every cross-origin host, and nothing at open time names the cause: `open-timeout` points at the network or a feature that is down, when the actual culprit is one response header on my own origin. I only found it by suspecting the header.

The platform hands the SDK a usable signal it currently ignores: after the COOP switch, the opener's `WindowProxy` for the popup reports `closed: true` even though the window is visibly open.

## Proposed fix / improvement

- After `window.open` succeeds, watch the proxy briefly; a popup whose proxy reports `closed` while the handshake is still pending should fail fast with a structured reason (an `open-failed` cause naming the severed opener) instead of running out the open-timeout clock.
- Document in the display-modes reference that `Cross-Origin-Opener-Policy: same-origin` on the feature origin is incompatible with `popup` from cross-origin hosts, beside the isolation guidance that recommends the header.

## Repro / evidence

Serve any feature with `Cross-Origin-Opener-Policy: same-origin` (one line in its `hf-serve.config.json`), declare `popup` in its `display.modes`, and open it as a popup from a host on a different origin. The popup renders; the host hangs to `open-timeout`. Live pairing: the deployed koi pond origin opened from the docs-site demo console.
