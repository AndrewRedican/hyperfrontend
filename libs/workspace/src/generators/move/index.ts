/**
 * The `move` generator: relocates a project under another directory and brings its names, aliases and references along.
 *
 * @module @hyperfrontend/workspace/generators/move
 */

export type { MovePlan } from './lib/move-helpers'
export type { MoveGeneratorOptions } from './options'
export { moveGenerator, moveGenerator as default } from './generator'
export { planMove } from './lib/move-helpers'
