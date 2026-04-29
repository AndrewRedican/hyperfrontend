/**
 * Inputs to {@link generateSeaConfig}.
 */
export interface SeaConfigInputs {
  /** Absolute path to the bundled CJS entry the SEA blob will execute. */
  mainPath: string
  /** Absolute path where the SEA blob should be emitted by `node --experimental-sea-config`. */
  outputPath: string
}

/**
 * Shape of the JSON document consumed by `node --experimental-sea-config`.
 *
 * Mirrors the [Node SEA configuration schema]
 * (https://nodejs.org/api/single-executable-applications.html). Builder always
 * sets `disableExperimentalSEAWarning` so the produced binary doesn't print
 * the warning banner on every invocation.
 */
export interface SeaConfigDocument {
  /** Absolute path to the script the SEA bundle will execute. */
  main: string
  /** Absolute path to the blob that `node --experimental-sea-config` will write. */
  output: string
  /** Suppresses the runtime "this is an experimental feature" warning. Always `true`. */
  disableExperimentalSEAWarning: true
}

/**
 * Builds the JSON document consumed by `node --experimental-sea-config <path>`.
 *
 * Builder always emits `disableExperimentalSEAWarning: true` to silence the
 * runtime warning banner on every native binary invocation — published bins
 * are expected to behave like first-class executables.
 *
 * @param inputs - Resolved absolute paths for the SEA `main` script and `output` blob.
 * @returns SEA config document ready to be JSON-serialized to disk.
 *
 * @example Generating a SEA config for a bin
 * ```typescript
 * const config = generateSeaConfig({
 *   mainPath: '/abs/dist/libs/builder/bin/hf-build.cjs.js',
 *   outputPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
 * })
 * ```
 */
export const generateSeaConfig = (inputs: SeaConfigInputs): SeaConfigDocument => ({
  main: inputs.mainPath,
  output: inputs.outputPath,
  disableExperimentalSEAWarning: true,
})
