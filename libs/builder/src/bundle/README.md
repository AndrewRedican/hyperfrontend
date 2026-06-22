# bundle

Bundle subdomain facade: entry-point discovery, externals resolution, Rollup driver, declaration emission, and the orchestrator that runs them in order.

`runBundlePhase(context, config)` walks the per-format configurations on the supplied `BuildConfig`, resolves the matching entry points, drives Rollup once per entry through the appropriate per-format descriptor factory, then calls `generateDeclarations` to emit `.d.ts` files and runs the closing prune and shared-dedupe passes. The phase returns aggregated `FormatOutputs` covering the ESM, CJS, IIFE, and UMD entries it produced — consumers compose this primitive into the larger `build()` facade.
