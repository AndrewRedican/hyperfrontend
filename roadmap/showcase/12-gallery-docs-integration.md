# 12 — Gallery / Docs-Site Integration

The self-hosting gallery: a showcase that is itself a hyperfrontend host, mounting demos as live features. Nesting proves itself (gallery host → demo host → demo hostee).

**Depends on** 04 _(delivered; plan removed)_, and the breadth + flagship demos [08](08-breadth-boundary-respecting.md)–[11](11-flagship-composed-app.md) · **Type** Execution · **Status**: Pending — not yet elaborated. **Subsumes** the old `feature/09-docs-site-integration.md` (removed).

See [00-strategy.md](00-strategy.md) (journey J6) and the [index](README.md).

## Scope (to elaborate)

- Realize the gallery within `apps/docs-site` (or a dedicated showcase site — decide): a host that mounts deployed demos as live features across display modes.
- Landing **carousel** with live embedded previews.
- **Per-demo pages**: live embed + browsable source + how-to guide (the teaching material that serves the portfolio).
- Consume the **deployed origins** from [deployment](00-strategy.md#deployment-and-the-origin-boundary-layer) via the registration mechanism (static manifest vs runtime registry).

## Carried decisions

- Both tiers: this gallery is the breadth tier; the flagship ([11](11-flagship-composed-app.md)) is the centerpiece tier.
- Proof = live; the gallery is where the proof becomes visible.

## Open questions

- Gallery inside the existing docs-site vs a separate showcase site.
- How demos register their live URLs + metadata.
