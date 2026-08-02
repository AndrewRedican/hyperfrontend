# F-004 — `defineConfig` rejects the config keys the CLI actually reads

| Field        | Value                       |
| ------------ | --------------------------- |
| Category     | api-friction                |
| Severity     | medium                      |
| Surfaced by  | demo-clock 0.3.0 re-consume |
| Status       | open                        |
| Disposition  | —                           |
| Graduated to | —                           |

## What happened

`hf build` resolves `protocol`, `display`, `permissions`, and `url` from `feature.config.*`, and 0.3.0's presentation model makes `display` the way a feature declares its modes. But `defineConfig` is typed as `(config: FeatureConfig) => FeatureConfig`, and `FeatureConfig` carries only `name`/`version`/`contract` — so authoring any of the four extended keys through `defineConfig` is a TypeScript excess-property error. The typed authoring helper cannot express a production config.

## Why it's friction (consumer lens)

The docs and the generated scaffold both point at `defineConfig` as the typed way to author the config, and the build gate simultaneously demands a deliberate `protocol` choice. Following both pieces of guidance at once produces a compile error, and the obvious escapes (dropping `defineConfig`, casting) give up exactly the type-checking the helper promises. `ResolvedFeatureConfig` (which has the keys) is close but wrong to author against — `url`/`protocol` are non-optional there.

## Proposed fix / improvement

Widen the authoring type: either extend `FeatureConfig` with the optional `url`/`protocol`/`display`/`permissions` keys the resolver reads, or introduce an explicit `AuthoredFeatureConfig` for `defineConfig`. The resolver already treats all four as optional, so the widening is purely additive.

Follow-up once the widened type publishes: migrate demo-clock's `feature.config.ts` back to `defineConfig` (it currently authors against a local widened `satisfies` type, noted in its README).

## Repro / evidence

```ts
import { defineConfig } from '@hyperfrontend/features'

export default defineConfig({
  name: 'clock',
  version: '0.2.0',
  contract: './clock.contract.ts',
  protocol: 'v1', // TS2353: Object literal may only specify known properties, and 'protocol' does not exist in type 'FeatureConfig'
})
```

CLI reads the keys regardless: `resolveBuildConfig` pulls `loaded['protocol']`, `loaded['display']`, `loaded['permissions']`, `loaded['url']` from the raw module. Verified 2026-08-01 against `@hyperfrontend/features@0.3.0`.
