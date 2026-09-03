# dedupe

Shared-first-party dedupe: an additive post-emit pass that lifts first-party modules inlined into multiple per-entry bundles into shared `_shared/<srcPath>/index.<fmt>.js` chunks and rewrites each consuming entry to import them. Runs over the already-bundled `esm`/`cjs` outputs only, leaving per-entry isolated bundling intact.

`hoistSharedFirstParty(...)` is the entry point. It only hoists copies that `planHoists` proves safe — structurally identical, references resolvable, and initialization cycle-free — so the worst case is output identical to the input.

The pass is built from composable stages, each exported for direct use: module attribution (`attribute`, `indexOwners`, `parseEntry`), source reachability (`collectReachableSources`), chunk planning and extraction (`planHoists`, `renderChunk`, `resolveModuleRefs`), and entry rewriting (`rewriteEntry`).

Ownership is bounded to modules reachable from the entry points' sources, so a spec-only fixture can never own a name, and reference classification is scope-aware (`collectFreeRefs`), so a parameter that shadows an owned name never becomes an import edge.
