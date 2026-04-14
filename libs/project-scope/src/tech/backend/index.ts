/**
 * Backend framework detection for Express, NestJS, Fastify, Koa, and Hono.
 *
 * @module @hyperfrontend/project-scope/tech/backend
 */
export type { BackendDetection, BackendDetector } from './types'
export { expressDetector } from './express'
export { nestDetector } from './nestjs'
export { fastifyDetector } from './fastify'
export { koaDetector } from './koa'
export { honoDetector } from './hono'
export { backendDetectors, detectBackendFrameworks } from './detect-all'
