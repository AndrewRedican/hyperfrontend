# models

Type definitions for builder configuration, runtime context, and build results.

This entry point re-exports the cross-cutting types consumed by the bundle, package, and bin subdomains: `BuildConfig` and the per-format configuration shapes (`EsmConfig`, `CjsConfig`, `IifeConfig`, `UmdConfig`), the `BinConfig` and `SeaConfig` declarations, the resolved `BuildContext` passed to primitives, and the `BuildResult` returned by the `build()` facade. Consumers composing builder primitives — or extending it with custom presets — import from here to stay aligned with the shapes the rest of the library expects.
