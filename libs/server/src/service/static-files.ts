import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStep } from '../static/serve-pipeline'
import type { StaticServeDeps } from '../static/static-serve'
import type { Step } from './contract'
import { runSteps } from '../static/serve-pipeline'
import { buildServeSteps } from '../static/serve-steps'

/**
 * Mounts the synchronous static pipeline as a terminal step: method guard, compression, header rules and file serving, exactly as `startStaticServer` runs them.
 * It answers every request it receives and never calls `next`, so it goes last. The config's `port`, `host` and `log` are ignored.
 * A file is read whole and synchronously, so a large one holds every other request of the service for the length of the read and the compression.
 * Only targets the service accepted reach the mount: an empty interior segment and a dot segment are refused before it, where the static server resolves them.
 *
 * @param config - The resolved serving plan: the root directory and the ordered header rules.
 * @param deps - File-system boundaries and custom static steps, which run ahead of the built-in ones; the disk and no custom step when omitted.
 * @returns The step. A request no route claimed and no file answers gets the static chain's 404, and a method other than `GET` and `HEAD` its 405.
 *
 * @example Serving a built site beside an API
 * ```typescript
 * import { resolve } from 'node:path'
 * import { health, jsonResponse, route, router, startService, staticFiles } from '@hyperfrontend/server'
 *
 * const api = router({ 'tickets.list': route('GET', '/tickets', () => jsonResponse(200, [])) }, { prefix: '/api' })
 * const site = staticFiles({ root: resolve('dist/site'), port: 0, log: false, headers: [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }] })
 * const service = await startService({ port: 8080, steps: [health(), api, site] })
 * // GET /api/tickets is routed; GET /index.html is read from dist/site; POST /index.html answers 405 with Allow: GET, HEAD
 * ```
 */
export function staticFiles(config: ResolvedServeConfig, deps?: Omit<StaticServeDeps, 'createServer' | 'log'>): Step {
  const steps: readonly ServeStep[] = [...(deps?.steps ?? []), ...buildServeSteps(config, deps)]
  // why: each request gets a context of its own, because the file step records the file it resolved there for the header rules
  return (request) => runSteps(steps, { method: request.method, url: request.url, headers: request.headers }, { config })
}
