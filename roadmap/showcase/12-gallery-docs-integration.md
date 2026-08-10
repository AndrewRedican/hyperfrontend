# 12 — Gallery / Docs-Site Integration: Residue

The self-hosting gallery lives in `apps/docs-site` (/demos): a cover-flow deck over the static manifest, live embeds through vendored generated shells, and a host console driving dialog/popup sessions. What remains is the teaching material and keeping registration current as demos land.

**Type** Execution · **Status**: Residue only.

See [00-strategy.md](00-strategy.md) and the [index](README.md).

## Remaining scope

- **Per-demo how-to guides** — the teaching material that serves the portfolio. The deck (with GitHub source links per demo) is the final gallery surface — dedicated per-demo pages are not planned — but the how-to content is still owed, as docs content wherever it best lives.
- **Register each new demo as it lands** (invariant #3): manifest entry, vendored shell where embedded, boundary label.
- **Recursive nesting in the gallery** — live today through the koi pond's gallery → pond host/hostee → fish chain; extended deliberately by the Russian-doll demo ([09](09-breadth-pattern.md)).

## Carried decisions

- Gallery lives inside the existing docs-site (resolved) — no separate showcase site.
- Registration via the static in-repo manifest (`src/lib/demo-manifest.ts`) with env-var origin overrides for local development (resolved) — no runtime registry.
- Both tiers stand: this gallery is the breadth tier; the flagship ([11](11-flagship-composed-app.md)) is the centerpiece tier.
