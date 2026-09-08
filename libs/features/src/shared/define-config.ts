import type { DevConfig, FeatureConfig, FeatureIsolation } from './types'

// note: The identity helpers live beside the types rather than in them so the type module stays declaration-only as the config surface grows.

/**
 * Identity helper that gives `feature.config.*` files type-checked authoring:
 * a pure inference-only function that returns its argument unchanged.
 *
 * The declared `isolation` is inferred, so `display.modes` is checked against
 * what that isolation can actually serve: a cross-origin isolated origin
 * severs the opener of any window a host opens onto it, so declaring one of
 * the windowed modes alongside it does not typecheck.
 *
 * @param config - The feature configuration object.
 * @returns The same configuration object, narrowed to {@link FeatureConfig}.
 *
 * @example Authoring a typed `feature.config.ts`
 * ```typescript
 * export default defineConfig({ name: 'clock', version: '1.0.0', contract: './clock.contract.json' })
 * ```
 *
 * @example Declaring isolation, which withdraws the windowed display modes
 * ```typescript
 * export default defineConfig({
 *   name: 'pond',
 *   version: '1.0.0',
 *   contract: './pond.contract.json',
 *   isolation: 'require-corp',
 *   display: { modes: ['embedded', 'dialog'] },
 * })
 * ```
 */
export const defineConfig = <const I extends FeatureIsolation | undefined = undefined>(config: FeatureConfig<I>): FeatureConfig<I> => config

/**
 * Identity helper that gives `hf-dev.config.*` files type-checked authoring.
 *
 * @param config - The dev-server configuration object.
 * @returns The same configuration object, narrowed to {@link DevConfig}.
 *
 * @example Authoring a typed `hf-dev.config.ts`
 * ```typescript
 * export default defineDevConfig({ apps: [{ name: 'clock', outputDir: 'dist/clock', port: 4200 }] })
 * ```
 */
export const defineDevConfig = (config: DevConfig): DevConfig => config
