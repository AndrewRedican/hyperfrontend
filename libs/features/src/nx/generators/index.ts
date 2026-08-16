/**
 * Nx generators entry point: the `init` and `feature` generators plus their
 * option shapes, for programmatic invocation and typed composition.
 *
 * @module @hyperfrontend/features/nx/generators
 */
export type { FeatureGeneratorSchema } from './feature/generator'
export type { InitGeneratorSchema } from './init/generator'
export { featureGenerator } from './feature/generator'
export { initGenerator } from './init/generator'
