# bin

Bin subdomain facade: JS bin synthesis composed via `runBinPhase`. Node SEA native binary primitives live under `@hyperfrontend/builder/bin/native`.

`runBinPhase(ctx, bins)` iterates the supplied `BinConfig[]`, calls `buildJsBin` for each declaration, and — for any bin that declares a `sea` block — also emits a Node SEA native binary via `buildNativeBin` (using the bin's CJS output as the SEA `main` script; a `sea` bin without a CJS format throws). Every emitted `BinOutput` is aggregated into a single flat list. Pass an empty array (or omit `config.bin` from the facade) to skip the phase entirely. Workspace dependencies are always inlined into bin bundles so each emitted JS artifact is a self-contained executable script with shebang + bootstrap footer + chmod 0o755 already applied.
