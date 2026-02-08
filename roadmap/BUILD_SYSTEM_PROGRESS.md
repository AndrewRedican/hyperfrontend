# Build System Architecture

The build system produces multi-format outputs (ESM + CJS) for all library packages using the custom `@hyperfrontend/package:build` executor.

---

## Output Structure

```
dist/libs/<package>/
├── index.esm.js      → ESM bundle (primary)
├── index.cjs.js      → CJS bundle (fallback)
├── index.d.ts        → TypeScript declarations
├── <feature>/        → Secondary entry points (if applicable)
└── package.json      → With conditional exports
```

---

## Planned: UMD/IIFE Bundles (lib-nexus, lib-network-protocol)

CDN-ready self-contained bundles for `<script>` tag usage:

```
dist/libs/<package>/bundle/
├── index.umd.min.js
└── index.iife.min.js
```

See [BUILD_SYSTEM_TODO.md](./BUILD_SYSTEM_TODO.md) for implementation status.

---

## Custom Executors

| Executor    | Location                                | Description                         |
| ----------- | --------------------------------------- | ----------------------------------- |
| `build`     | `tools/package/src/executors/build`     | Auto-discovers entries, dual output |
| `publish`   | `tools/package/src/executors/publish`   | npm publishing with dry-run         |
| `version`   | `tools/package/src/executors/version`   | Idempotent semver wrapper           |
| `typecheck` | `tools/package/src/executors/typecheck` | TypeScript checking                 |

---

## Related

- [BUILD_SYSTEM_TODO.md](./BUILD_SYSTEM_TODO.md) — Pending work
- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) — Publishing workflow
- [SEMVER_INTEGRATION_ANALYSIS.md](./SEMVER_INTEGRATION_ANALYSIS.md) — Versioning issues
