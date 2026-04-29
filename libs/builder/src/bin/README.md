# bin

Bin subdomain facade: JS bin synthesis (Phase 6) composed via `runBinPhase`. Native (Node SEA) emission is added in a later phase and lives under `@hyperfrontend/builder/bin/native`.

`runBinPhase(context, bins)` iterates the supplied `BinConfig[]`, calls `buildJsBin` for each declaration, and aggregates every emitted `BinOutput` into a single flat list. Pass an empty array (or omit `config.bin` from the facade) to skip the phase entirely. Workspace dependencies are always inlined into bin bundles so each emitted artifact is a self-contained executable script with shebang + bootstrap footer + chmod 0o755 already applied.
