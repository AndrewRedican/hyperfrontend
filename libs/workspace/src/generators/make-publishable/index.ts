/**
 * The `make-publishable` generator: gives a library the targets, manifest fields, README and e2e project a published package needs.
 *
 * @module generators/make-publishable
 */

export type { PublishablePlan } from './generator'
export type { BundleFormat, MakePublishableGeneratorOptions } from './options'
export { makePublishableGenerator, makePublishableGenerator as default, planPublishable } from './generator'
