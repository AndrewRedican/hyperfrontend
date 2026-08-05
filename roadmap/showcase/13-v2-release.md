# 13 — v2 Release: Residue

The release loop ran (features is published through 0.5.x and both live demos consume it). What remains is the docs refresh the loop owed, one hygiene republish that never happened, and verifying the live embeds after the next redeploy.

**Type** Execution · **Status**: Residue only.

See [00-strategy.md](00-strategy.md) and the [index](README.md).

## Remaining work

1. **Docs refresh** (the original step-8 scope, still open):
   - `libs/features` README has **zero plugin-seam coverage**; ARCHITECTURE mentions it in a single table row. Cover plugins (`ShellOptions.plugins`, lifecycle, element per display mode) with `@example` blocks, alongside request/response, typed connectors, protocol-in-artifact, and dev-server usage where thin.
   - `libs/nexus` README lacks the delivery-semantics story: full message envelope, self-oriented contracts, and the SSR-safe lazy default broker.
   - How-to guides written against current published reality.
2. **Hygiene republish** (recommended in the release PR, never executed): `network-protocol` and `cryptography` remain at 0.2.1, published **before** the `string-utils` import-time side-effect fix — their bundles still embed the pre-fix copy. Rebuild-only patch republish of both.
3. **Verify the live embeds after the next merge to `main`**: Railway redeploys both demo services via the GitHub integration once CI passes; the deployed clock currently refuses the handshake until that rebuild. Confirm both gallery embeds go live with clean message logs.

## Deliberately deferred follow-ups (tracked)

- Same-class module-scope hazards left untouched (currently unreachable): `immutable-api-utils` websocket statics, `cryptography` subtle capture.
- Code-first-only feature configs (dropping `*.json` support) — direction noted during the connector grill; typed projection landed without it.

## Open questions

- Whether findings graduate to public GitHub issues for portfolio-visible rigor.
