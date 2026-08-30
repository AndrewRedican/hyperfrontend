# Comparison Matrix

Deliverable 2 (REQ-MATRIX-01..06). Research snapshot: August 2026.

## Files

- `attributes.json` / `attributes.md`: the attribute catalogue. 220 atomic, mechanically
  decidable questions in 15 groups, each with a stable dotted id (REQ-DATA-06). The md
  version carries the merged/renamed-id appendix from consolidation.
- `columns/<unit>.json`: one column per comparison unit (30 units), produced from that unit's
  evidence dossier in [../research/solutions/](../research/solutions/). These are the source
  of record: 6600 verdicts, each with its provenance.
- `matrix-compact.tsv`: one letter per cell (`y` `n` `c` `-` `?`), the projection quoted as
  the evidence base across [../model/](../model/) and [../scenarios/](../scenarios/).
  Committed because those quotes cite it; regenerate and diff to prove it still matches.
- `assemble.mjs`: validates every column against the catalogue, and on request projects the
  columns into either assembled form. It writes nothing unless asked.
- `check-projection.mjs`: the drift guard between the model and the published dataset. See
  [../README.md](../README.md).

```
node assemble.mjs                          # validate only
node assemble.mjs --tsv matrix-compact.tsv # refresh the compact projection
node assemble.mjs --json /tmp/matrix.json  # the full 1.4 MB matrix, generated on demand
```

The full matrix is not committed: it is a mechanical restatement of `columns/` and nothing in
the repository reads it.

## Value vocabulary (REQ-MATRIX-02)

`yes | no | conditional | na | unknown`, lowercase. A `conditional` verdict MUST carry a
`condition` string (edition, mode, or "varies by implementation" for strategy units). `na`
means the attribute genuinely does not apply to that kind of unit. `unknown` is honest
ignorance, never a guess (REQ-MATRIX-05).

Two scale-valued rows (`migration.participant.min-level`, `migration.host.min-level`) encode
their scale id from [../model/migration.md](../model/migration.md) in `condition`.

## Provenance per verdict (REQ-DATA-05)

`claimType` (framework-guarantee | browser-guarantee | common-pattern | possible-extension |
officially-supported | community-convention | inference), `confidence` (high/medium/low),
`evidence` (dossier section names or URLs), column-level `verifiedAt`. Never convert possible
into supported, typically into required, or isolated into secure without the boundary stated
(the boundary lives in the dossier the evidence points to).

## Units

19 implementations/products, 7 vendor-neutral strategies, 4 non-MFE baselines (the
should-you-even outcomes of REQ-Q-04). Graveyard units are narrative-only (see
[../research/landscape-inventory.md](../research/landscape-inventory.md)); the
toolchain-branded wrapper layer resolves brands to underlying units instead of holding a
column.

## Reading order

Architects: attributes.md first, then `matrix-compact.tsv` for the shape and the column files
for the reasoning behind any cell that matters. Model work clusters these columns into
families and latent dimensions in [../model/](../model/).
