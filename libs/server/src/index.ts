/**
 * A small HTTP kernel for Node.js: a service is a list of steps that return responses, run as a process with fixed exit codes, one started line and a graceful stop.
 *
 * @module @hyperfrontend/server
 */
export type { ClockDeps, ServiceClock } from './service/clock'
export type {
  BaseContext,
  ClientInfo,
  Handler,
  Next,
  NoContext,
  QueryView,
  RequestBody,
  RouteParams,
  ServiceRequest,
  ServiceResponse,
  Step,
  StepContext,
  StepResult,
} from './service/contract'
export type { CorsOptions } from './service/cors'
export type { FailureEvent, RequestEvent, RequestOutcome, ServiceEvent } from './service/events'
export type { HealthOptions, ReadinessOptions } from './service/health'
export type { HttpError } from './service/http-error'
export type { PathParams } from './service/route-pattern'
export type { Method, Route, RouteOptions, RouterOptions } from './service/router'
export type { JsonValue, ProcessOutput, RunContext, RunDeps, ServiceDefinition, ServiceProcess, StartedService } from './service/run'
export type { ServiceBuildSeal, ServiceBuildStamp } from './service/run-build'
export type { ServiceDeps, ServiceHandle, ServiceOptions } from './service/service'
export type { ServeStep, ServeStepContext, StaticRequest, StaticResponse } from './static/serve-pipeline'
export type { ServeStepDeps } from './static/serve-steps'
export type { StaticHandlerDeps } from './static/static-handler'
export type { StaticServeDeps, StaticServerHandle } from './static/static-serve'
export { addressPort, closeServer, listen } from './listen'
export { cors } from './service/cors'
export { formatEvent } from './service/events'
export { headerRules } from './service/header-rules'
export { health, readiness } from './service/health'
export { httpError, isHttpError } from './service/http-error'
export { chain, guard } from './service/pipeline'
export { jsonResponse } from './service/responses'
export { route, router } from './service/router'
export { defineService, runService } from './service/run'
export { sealServiceBuild } from './service/run-build'
export { startService } from './service/service'
export { staticFiles } from './service/static-files'
export { waitForShutdown } from './shutdown'
export { buildCompressionStep, negotiateEncoding } from './static/serve-compression'
export { headerValue, plainResponse, runSteps } from './static/serve-pipeline'
export { buildServeSteps } from './static/serve-steps'
export {
  confineDecodedPath,
  contentTypeFor,
  createStaticHandler,
  decodeRequestPath,
  directoryLocation,
  requestPath,
  serveFile,
} from './static/static-handler'
export { createServeListener, startStaticServer } from './static/static-serve'
