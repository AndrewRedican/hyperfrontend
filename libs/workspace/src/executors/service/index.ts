/**
 * The `service` executor: builds a service into one CommonJS main with its manifests and assets, sealed by the kernel it is written on.
 *
 * @module @hyperfrontend/workspace/executors/service
 */

export type { JsonValue, ServiceConfig, ServiceConfigIssue, ServiceConfigIssueCode } from './config'
export type { ServiceManifest, ServiceManifestSection } from './manifest'
export type { ServiceExecutorOptions } from './options'
export { checkServiceConfig } from './config'
export { serviceExecutor, serviceExecutor as default } from './executor'
