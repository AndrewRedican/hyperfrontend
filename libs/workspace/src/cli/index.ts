/**
 * The workspace's command line as a function: what the `hf` executable runs, and what another command line hands its arguments to.
 *
 * @module cli
 */

export type { GraphOutput } from './graph'
export type { FeaturesCli, HandoverHost, Invocation, TextSink } from './handover'
export type { WorkspaceCliOptions } from './run'
export { GRAPH_USAGE, runGraph } from './graph'
export { FEATURES_CLI, handOver, processHost } from './handover'
export { isOwnCommand, runWorkspaceCli, USAGE, WORKSPACE_FILE } from './run'
