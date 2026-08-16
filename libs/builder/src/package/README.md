# package

Package subdomain facade: package.json synthesis + write, generic asset copy, and opt-in third-party license collection.

`runPackagePhase(context, config, formatOutputs)` composes `synthesizePackageJson` with the resolved build context, writes the dist `package.json`, materializes the configured `AssetSpec` list via `copyAssets`, and, when `config.thirdPartyLicenses` is enabled, derives the external dependency list from the synthesized package, runs `collectThirdPartyLicenses`, and emits `THIRD_PARTY_LICENSES.md`. Each step is also exposed as a standalone primitive under the `./package/json`, `./package/assets`, and `./package/licenses` subpaths so wrappers can compose them directly.
