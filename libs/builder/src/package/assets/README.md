# assets

Generic asset-copy primitive consumed by the package phase.

`copyAssets(specs, outputPath, srcPkg)` materializes a list of [`AssetSpec`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-AssetSpec) entries into the build output. Each spec selects its inputs via either an explicit `files: string[]` list or a POSIX-style `glob: string` evaluated relative to [`spec.from`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-AssetSpec-prop-from), and writes them under `<outputPath>/<spec.to>` (defaulting to the dist root). Specs gated by a [`condition`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-AssetSpec-prop-condition) predicate are skipped when the predicate returns `false`. Builder ships with **zero** default-asset knowledge; wrappers supply their own asset spec lists.
