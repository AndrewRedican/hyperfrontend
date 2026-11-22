import { METHODS as PARSED_METHODS } from 'node:http'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * The methods a route may name. `QUERY` (RFC 10008) asks a question too large or too structured for a query string: safe and idempotent like `GET`, with the question in a body that must carry a `Content-Type`, and with a response that may be cached.
 * Its handler reads that body with the request's body readers, which answer 415 to a JSON read without a JSON content type, and may advertise the formats it accepts in an `Accept-Query` response header of its own.
 * A `QUERY` route needs a version of Node.js whose HTTP parser knows the method: on any other, `router` refuses the route at construction, because the parser would answer 400 before the route was asked.
 */
export type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'QUERY' | 'OPTIONS'

// note: Every method a route may name, in the order an Allow header lists them.
export const ROUTE_METHODS: readonly Method[] = freeze(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'QUERY', 'OPTIONS'])

/**
 * Tells what is wrong with the method of a route: a value that is no method a route may name, or a method no request could arrive with, because Node's HTTP parser answers 400 to a method it does not know before a step is asked.
 *
 * @param method - What the route holds as its method, which no compiler need have seen.
 * @param runtime - The methods the HTTP parser of the running Node.js knows; `METHODS` of `node:http` when omitted.
 * @returns The problem, to put after the name of the route, or `null` for a method a request can arrive with.
 *
 * @example Checking a method against what two runtimes parse
 * ```typescript
 * methodProblem('QUERY', ['GET', 'POST', 'QUERY'])
 * // => null
 * methodProblem('QUERY', ['GET', 'POST'])
 * // => 'the method QUERY is not parsed by this version of Node.js.'
 * methodProblem('TRACE')
 * // => 'the method must be one of GET, HEAD, POST, PUT, PATCH, DELETE, QUERY, OPTIONS.'
 * ```
 */
export function methodProblem(method: unknown, runtime: readonly string[] = PARSED_METHODS): string | null {
  if (!ROUTE_METHODS.includes(method as Method)) {
    return `the method must be one of ${ROUTE_METHODS.join(', ')}.`
  }
  return runtime.includes(method as Method) ? null : `the method ${method as Method} is not parsed by this version of Node.js.`
}
