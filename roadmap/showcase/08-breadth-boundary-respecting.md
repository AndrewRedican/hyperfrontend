# 08 — Breadth: Boundary-Respecting Batch

Enterprise/gallery features where iframe isolation is _appropriate_ and contract-validated messaging is the proof. Built via the generator, deployed as-you-go.

**Depends on** [06](06-demo-2-and-generator.md) · **Type** Execution · **Status**: Pending — not yet elaborated. Parallelizable with [09](09-breadth-pattern.md).

See [00-strategy.md](00-strategy.md) and the [index](README.md).

## Scope (to elaborate)

- Candidates (curated in [catalog.md](catalog.md)): stock dashboard, payments (**real** backend), auth flow (**real** backend), JSON fixer, omni-bar, footer, navbar, employee directory, and selected entries from the 50-item enterprise table.
- Each: a complete composition, deployed to its own origin(s), registered in the gallery, findings filed.
- The "serious capability" half of the portfolio.

## Carried decisions

- Mock unless it merits real; auth/payments warrant a real (small Railway) backend service ([deployment](00-strategy.md#deployment-and-the-origin-boundary-layer)).

## Open questions

- Which demos warrant real backends vs convincing mocks.
- Batch size and ordering.
