# assets

Generic asset-copy primitive consumed by the package phase.

`copyAssets(specs, outputPath, srcPkg)` materializes a list of `AssetSpec` entries into the build output. Each spec selects its inputs via either an explicit `files: string[]` list or a POSIX-style `glob: string` evaluated relative to `spec.from`, and writes them under `<outputPath>/<spec.to>` (defaulting to the dist root). Specs gated by a `condition` predicate are skipped when the predicate returns `false`. Builder ships with **zero** default-asset knowledge; wrappers supply their own asset spec lists.
