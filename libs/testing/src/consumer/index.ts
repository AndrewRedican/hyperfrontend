/**
 * A packed package installed outside the workspace and driven through plain Node child
 * processes, for testing what a consumer installs rather than what the workspace resolves.
 *
 * @module @hyperfrontend/testing/consumer
 */
export type { ConsumerRun, EntryLoad, ModuleKind, PackedConsumer, PackedConsumerOptions, RunOptions } from './packed-consumer'
export { createPackedConsumer, usePackedConsumer } from './packed-consumer'
