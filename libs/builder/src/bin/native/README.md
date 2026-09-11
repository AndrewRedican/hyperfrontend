# native

Node SEA (single-executable application) primitives: turn an already-built CJS bin bundle into a self-contained native binary via the `node --experimental-sea-config` + [postject](https://www.npmjs.com/package/postject) pipeline.

`buildNativeBin({ bin, ctx, cjsOutputPath })` orchestrates the full pipeline, in order:

1. Validates the bin declares a CJS format.
2. Skips silently with an info log when the current host doesn't match any declared `sea.platforms` entry. CI orchestrates the matrix, so each declared platform is built on the matching runner.
3. Generates the SEA config JSON via `generateSeaConfig`.
4. Runs `generateSeaBlob`, which spawns `node --experimental-sea-config <path>` and emits the SEA preparation blob.
5. Resolves the Node host via `resolveHostBinary` (current platform only, defaulting to `process.execPath`).
6. Dispatches a forked inject worker via `dispatchInjectWorker` (resolved through `resolveDefaultInjectWorkerPath`), which clones the host to `<outputPath>/bin/<name>.<platform>-<arch>` (with `.exe` on Windows) and embeds the blob through postject's programmatic API.
7. Calls `removeCodesign` to strip the macOS signature the injection invalidated, so the unsigned binary still runs.
8. Deletes the SEA build intermediates (the config JSON + prep blob), so only the runtime binary remains in the output.

Re-signing with a real Apple Developer identity is left to release tooling; `applyCodesign` provides an ad-hoc default for local execution. Native binaries are intentionally not auto-wired into `package.json#bin`; they are shipped as separate release artifacts.

The `currentPlatformMatches` / `currentPlatformTarget` helpers, `NODE_SEA_RESOURCE_NAME` / `NODE_SEA_MACHO_SEGMENT` / `NODE_SEA_FUSE` constants, and individual primitive functions (including the standalone `injectBlob`) are exported for callers that need finer-grained composition.
