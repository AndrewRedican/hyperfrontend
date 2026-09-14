# native

Node SEA (single-executable application) primitives: turn an already-built CJS bin bundle into a self-contained native binary via the `node --experimental-sea-config` + [postject](https://www.npmjs.com/package/postject) pipeline.

`buildNativeBin({ bin, ctx, cjsOutputPath })` orchestrates the full pipeline, in order:

1. Validates the bin declares a CJS format.
2. Skips silently with an info log when the current host doesn't match any declared [`sea.platforms`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-SeaConfig-prop-platforms) entry. CI orchestrates the matrix, so each declared platform is built on the matching runner.
3. Generates the SEA config JSON via [`generateSeaConfig`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-generateSeaConfig).
4. Runs [`generateSeaBlob`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-generateSeaBlob), which spawns `node --experimental-sea-config <path>` and emits the SEA preparation blob.
5. Resolves the Node host via [`resolveHostBinary`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-resolveHostBinary) (current platform only, defaulting to `process.execPath`).
6. Dispatches a forked inject worker via [`dispatchInjectWorker`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-dispatchInjectWorker) (resolved through [`resolveDefaultInjectWorkerPath`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-resolveDefaultInjectWorkerPath)), which clones the host to `<outputPath>/bin/<name>.<platform>-<arch>` (with `.exe` on Windows) and embeds the blob through postject's programmatic API.
7. Calls [`removeCodesign`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-removeCodesign) to strip the macOS signature the injection invalidated, so the unsigned binary still runs.
8. Deletes the SEA build intermediates (the config JSON + prep blob), so only the runtime binary remains in the output.

Re-signing with a real Apple Developer identity is left to release tooling; [`applyCodesign`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-applyCodesign) provides an ad-hoc default for local execution. Native binaries are intentionally not auto-wired into `package.json#bin`; they are shipped as separate release artifacts.

The [`currentPlatformMatches`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-currentPlatformMatches) / [`currentPlatformTarget`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-currentPlatformTarget) helpers, [`NODE_SEA_RESOURCE_NAME`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-NODE_SEA_RESOURCE_NAME) / [`NODE_SEA_MACHO_SEGMENT`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-NODE_SEA_MACHO_SEGMENT) / [`NODE_SEA_FUSE`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-NODE_SEA_FUSE) constants, and individual primitive functions (including the standalone [`injectBlob`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/native/#api-injectBlob)) are exported for callers that need finer-grained composition.
