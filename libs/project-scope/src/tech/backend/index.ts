/**
 * Backend framework detection for Express, NestJS, Fastify, Koa, and Hono.
 *
 * @module @hyperfrontend/project-scope/tech/backend
 */
export type { BackendDetection, BackendDetector } from './types'
export { backendDetectors, detectBackendFrameworks } from './detect-all'
export { expressDetector } from './express'
export { fastifyDetector } from './fastify'
export { honoDetector } from './hono'
export { koaDetector } from './koa'
export { nestDetector } from './nestjs'
