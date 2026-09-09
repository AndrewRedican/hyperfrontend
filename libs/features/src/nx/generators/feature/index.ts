/**
 * Scaffolds an existing application into a hyperfrontend feature from an Nx
 * generator, staging every write the headless `hf init` makes through the Nx
 * tree so a dry run touches no disk.
 *
 * @module @hyperfrontend/features/nx/generators/feature
 */
export type { FeatureGeneratorSchema } from './generator'
export { default, featureGenerator } from './generator'
