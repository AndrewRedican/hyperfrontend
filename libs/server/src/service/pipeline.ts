import type { BaseContext, Handler, ServiceRequest, ServiceResponse, Step, StepContext, StepResult } from './contract'
import type { HttpError } from './http-error'
import { Readable } from 'node:stream'
import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { httpError, isHttpError, renderFailure } from './http-error'
import { guardStream, isStale, releaseBody, responseProblem } from './response-check'

/** A step with its context types erased: what it needs and adds was settled where the steps were composed. */
type LooseStep = Step<object, object>

/** The context of any step, whatever layers it carries. */
type LooseContext = StepContext<object>

/** What a pipeline runs when its last step delegates: it receives the context that step extended and everything the steps added, merged left to right, or `undefined` when none added anything. */
type Past = (context: LooseContext, added: object | undefined) => StepResult

/** One run of a pipeline: what stays the same from step to step. */
interface PipelineRun {
  /** The steps, outermost first. */
  readonly steps: readonly LooseStep[]
  /** The request every step receives. */
  readonly request: ServiceRequest
  /** What runs past the last step. */
  readonly past: Past
}

/**
 * Ends a pipeline that no step answered.
 *
 * @throws {HttpError} Always: the 404 the enclosing boundary renders.
 */
const notFound: Past = () => {
  throw httpError(404, 'not-found')
}

/**
 * Builds the context the rest of a pipeline runs with: a frozen copy carrying the addition, with `signal`, `client`,
 * `annotate` and `report` put back from the current context so that an addition cannot replace them.
 *
 * @param context - The context of the step that delegates.
 * @param extra - What the step adds for everything inside it, or `undefined` for nothing.
 * @returns The same context object when nothing is added, else a new frozen one.
 *
 * @example Adding a layer for the steps inside
 * ```typescript
 * const inside = extendContext(context, { tenant: 'acme' })
 * // inside.tenant === 'acme', inside.signal === context.signal, and context has no tenant
 * ```
 */
export function extendContext<Context extends BaseContext>(context: Context, extra: object | undefined): Context {
  if (extra === undefined) {
    return context
  }
  const { signal, client, annotate, report } = context
  return freeze({ ...context, ...extra, signal, client, annotate, report })
}

/**
 * Answers a fault with the plain 500 and tells the event sink, unless the context's signal has aborted:
 * by then the exchange is over or the route's deadline has passed, and what arrives late is not a fault to log.
 *
 * @param context - The context of the boundary.
 * @param code - The failure code to report under.
 * @param error - What went wrong; only its name reaches the sink.
 * @returns The 500 response, annotated `failure: internal`.
 */
function fault(context: BaseContext, code: string, error: unknown): ServiceResponse {
  if (!context.signal.aborted) {
    context.report(code, error)
  }
  context.annotate('failure', 'internal')
  return renderFailure(httpError(500, 'internal'))
}

/**
 * Checks a value on its way out of a boundary. A value that is no valid response is released and answered by a 500;
 * so is a stream body that is no longer fresh, and a value whose body cannot be read again after the check. A fresh stream body gets the kernel's error listener.
 *
 * @param value - What a step returned, or what a failure rendered to.
 * @param context - The context of the boundary.
 * @returns The value itself when it may be written, else the 500 that replaces it.
 */
function accept(value: unknown, context: BaseContext): ServiceResponse {
  if (responseProblem(value) !== null) {
    releaseBody(value)
    return fault(context, 'invalid-response', createTypeError('invalid response'))
  }
  const response = value as ServiceResponse
  let body: ServiceResponse['body']
  try {
    // why: a body behind a getter may throw on a later read or hand out another stream each time, so the boundary reads it once after the check
    body = response.body
  } catch {
    return fault(context, 'invalid-response', createTypeError('invalid response'))
  }
  if (!(body instanceof Readable)) {
    return response
  }
  if (isStale(body)) {
    const cause = body.errored ?? createError('the stream body was already used')
    releaseBody(body)
    return fault(context, 'stream-failed', cause)
  }
  guardStream(body)
  return response
}

/**
 * Turns a failure a step chose into its response, checked like any returned value, and annotates its code.
 *
 * @param error - The failure, as `isHttpError` recognised it.
 * @param context - The context of the boundary.
 * @returns The rendered failure, or the 500 that replaces one that could not be written.
 */
function refusal(error: HttpError, context: BaseContext): ServiceResponse {
  let rendered: unknown
  try {
    rendered = renderFailure(error)
  } catch {
    // why: a failure built by other code may carry headers that throw when read; it is then a response that cannot be written
    rendered = undefined
  }
  const accepted = accept(rendered, context)
  if (accepted === rendered) {
    context.annotate('failure', error.code)
  }
  return accepted
}

/**
 * The boundary every `next()` and the listener run behind: it resolves with a response for every outcome of the run and never rejects.
 * A thrown or rejected `HttpError` is rendered and its code annotated; any other thrown value becomes a 500 and is reported as `step-failed`;
 * a returned value that is no valid response, or whose stream body is no longer fresh, is released, reported and replaced by a 500;
 * a fresh stream body gets the kernel's error listener. Nothing is reported once the context's signal has aborted.
 *
 * @param run - Runs what lies behind the boundary; it may return, throw, resolve or reject.
 * @param context - The context whose `annotate`, `report` and `signal` the boundary uses.
 * @returns A promise for the response to pass outward.
 *
 * @example Running a handler behind the boundary
 * ```typescript
 * const response = await settle(() => handler(request, context), context)
 * // a throw from the handler arrives here as a 4xx or 5xx response
 * ```
 */
export async function settle(run: () => StepResult, context: BaseContext): Promise<ServiceResponse> {
  let returned: unknown
  try {
    returned = await run()
  } catch (error) {
    return isHttpError(error) ? refusal(error, context) : fault(context, 'step-failed', error)
  }
  return accept(returned, context)
}

/**
 * Runs the step at one position of a pipeline, giving it a `next` that runs the rest behind the boundary.
 *
 * @param run - The steps, the request and what lies past the last step.
 * @param index - The position of the step to run.
 * @param context - The context this step receives.
 * @param added - Everything the steps before this one added, merged left to right.
 * @returns What the step returned, or what lies past the last step.
 */
function runFrom(run: PipelineRun, index: number, context: LooseContext, added: object | undefined): StepResult {
  const step = run.steps[index]
  if (step === undefined) {
    return run.past(context, added)
  }
  let inner: Promise<ServiceResponse> | null = null
  const next = (extra?: object): Promise<ServiceResponse> => {
    if (inner !== null) {
      // why: thrown, not returned as a rejected promise, because a step that ignored such a promise would leave an unhandled rejection
      throw createError('next() was called more than once.')
    }
    const extended = extendContext(context, extra)
    inner = settle(() => runFrom(run, index + 1, extended, extra === undefined ? added : { ...added, ...extra }), extended)
    return inner
  }
  const drop = (error: unknown): never => {
    // why: a step that fails after calling next() has dropped the response it was given, so its stream body is released when it has arrived
    if (inner !== null) {
      void inner.then(releaseBody)
    }
    throw error
  }
  let result: StepResult
  try {
    result = step(run.request, context, next)
  } catch (error) {
    return drop(error)
  }
  return promiseResolve(result).then(undefined, drop)
}

/**
 * Runs steps outermost first. Each step's `next(extra)` runs the rest behind the boundary with the context extended, may be called once,
 * and throws on a second call; a step that throws or rejects after calling it has the response it was given released.
 * The first step runs unguarded: the caller puts the whole run behind `settle`.
 *
 * @param steps - The steps, outermost first.
 * @param request - The request every step receives.
 * @param context - The context the first step receives.
 * @param past - What runs when the last step delegates; a thrown 404 `not-found` when omitted.
 * @returns What the first step returned, now or later; it throws or rejects when that step does.
 *
 * @example Running a service's steps behind the outermost boundary
 * ```typescript
 * const response = await settle(() => runPipeline(steps, request, context), context)
 * ```
 */
export function runPipeline(
  steps: readonly LooseStep[],
  request: ServiceRequest,
  context: LooseContext,
  past: Past = notFound
): StepResult {
  return runFrom({ steps, request, past }, 0, context, undefined)
}

/**
 * Composes steps, outermost first, into one step. Each step sees what the earlier ones added, and the result adds everything they add.
 * This is what carries a widened context in the types; a plain list of steps behaves the same at run time but types nothing. Nest calls for more than four steps.
 * A step chained in front of a router runs for every request the chain is given, before the router has looked at the path: a request for an unknown path with no credential gets that step's 401 and not a 404.
 * So where a chained table stands among open ones is behaviour: every request an earlier step did not answer meets the chain's first step.
 *
 * @param first - The outermost step.
 * @param second - The step inside it, which may read what the first adds.
 * @returns One step that needs what the first needs and adds what both add.
 *
 * @example Carrying who is calling from one step to the next
 * ```typescript
 * import type { NoContext, Step } from '@hyperfrontend/server'
 * import { chain, httpError, jsonResponse } from '@hyperfrontend/server'
 *
 * interface Authenticated {
 *   readonly subject: string
 * }
 * const requireIdentity: Step<NoContext, Authenticated> = async (request, _context, next) => {
 *   const subject = await verify(request.headers.authorization)
 *   if (subject === null) throw httpError(401, 'unauthenticated', { 'WWW-Authenticate': 'Bearer' })
 *   return next({ subject })
 * }
 * const whoAmI: Step<Authenticated> = (_request, context) => jsonResponse(200, { subject: context.subject })
 *
 * const api = chain(requireIdentity, whoAmI) // a Step<NoContext, Authenticated>
 * ```
 */
export function chain<N extends object, A1 extends object, A2 extends object>(
  first: Step<N, A1>,
  second: Step<N & A1, A2>
): Step<N, A1 & A2>
export function chain<N extends object, A1 extends object, A2 extends object, A3 extends object>(
  first: Step<N, A1>,
  second: Step<N & A1, A2>,
  third: Step<N & A1 & A2, A3>
): Step<N, A1 & A2 & A3>
export function chain<N extends object, A1 extends object, A2 extends object, A3 extends object, A4 extends object>(
  first: Step<N, A1>,
  second: Step<N & A1, A2>,
  third: Step<N & A1 & A2, A3>,
  fourth: Step<N & A1 & A2 & A3, A4>
): Step<N, A1 & A2 & A3 & A4>
/**
 * Composes any number of steps at run time; the signatures above type two, three and four.
 *
 * @param steps - The steps, outermost first.
 * @returns One step that runs them in order and hands everything they added to the step after it.
 *
 * @example Composing three layers of context
 * ```typescript
 * import { chain } from '@hyperfrontend/server'
 *
 * const api = chain(requireTenant, requireIdentity, requireRole)
 * ```
 */
export function chain(...steps: LooseStep[]): LooseStep {
  return (request, context, next) => runPipeline(steps, request, context, (_extended, added) => next(added))
}

/**
 * Puts one step in front of one handler, for a check that belongs to a single route. The step reads the route's params loosely typed.
 * It is also where a check goes whose refusals must not log the path: the router names the route before the guard runs, where a step ahead of the router refuses a request no route has claimed.
 *
 * @param step - The check; it delegates with `next` to let the request through.
 * @param handler - The handler behind it, which receives whatever the step adds to the context.
 * @returns A handler that runs the step, then the handler behind the same boundary a pipeline uses.
 *
 * @example Guarding one handler with a check of a request header
 * ```typescript
 * import type { Handler, Step } from '@hyperfrontend/server'
 * import { guard, httpError, jsonResponse } from '@hyperfrontend/server'
 *
 * const requireKey: Step = (request, _context, next) => {
 *   if (request.headers['x-service-key'] === undefined) throw httpError(401, 'unauthenticated')
 *   return next()
 * }
 * const readTicket: Handler = (request) => jsonResponse(200, { id: request.params['id'] })
 *
 * const guarded = guard(requireKey, readTicket)
 * ```
 */
export function guard<N extends object, A extends object, P extends object>(step: Step<N, A>, handler: Handler<N & A, P>): Handler<N, P> {
  return (request, context) =>
    runPipeline([step as unknown as LooseStep], request as unknown as ServiceRequest, context, (extended) =>
      handler(request, extended as StepContext<N & A>)
    )
}
