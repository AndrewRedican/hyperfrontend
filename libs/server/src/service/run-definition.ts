import type { EnvironmentShape } from '../environment/contract'
import type { ServiceDefinition, StartedService } from './run'
import type { FatalFields } from './run-lines'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { errorName } from './events'
import { listLines } from './run-lines'

/** Time a start function has to settle when the definition names none, in milliseconds. */
export const START_TIMEOUT_MS = 30000

/** Time a stop has, from its first cause until `close()` has settled, when the definition names none, in milliseconds. */
export const STOP_TIMEOUT_MS = 15000

/** How long after a stop began a repeated signal is ignored, in milliseconds. */
export const FORCE_AFTER_MS = 1000

/** The longest wait for the two streams before the process is ended anyway, in milliseconds. */
export const FLUSH_MS = 2000

/** The longest delay a Node timer takes, in milliseconds: the bound of the two times, and what the timer that holds a running service is armed with. */
export const HOLD_MS = 2147483647

/** How many faults write a block while a service is stopping. */
export const FAULT_LIMIT = 8

/** A definition read once, so that nothing of a run reads a member of it a second time. */
export interface DefinitionReading<Shape extends EnvironmentShape> {
  /** The environment, the start function and the immutable section as plain members, or `null` for a definition that cannot be run. */
  readonly service: Pick<ServiceDefinition<Shape>, 'environment' | 'start' | 'immutable'> | null
  /** Time allowed for the start, in milliseconds: the definition's own, or the default. */
  readonly startTimeoutMs: number
  /** Time allowed for the stop, in milliseconds: the definition's own, or the default. */
  readonly stopTimeoutMs: number
  /** The fields of the fatal block of a definition that cannot be run: the name of what reading it threw, or none. */
  readonly fields: FatalFields
  /** The detail lines of that block: one per problem, or none when reading threw. */
  readonly detail: readonly string[]
}

/**
 * Narrows an unknown value to something whose members can be read by name.
 *
 * @param value - The value to test.
 * @returns `true` for a non-null object, whatever its prototype.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Judges one of the two times a definition may name.
 *
 * @param definition - The definition under judgement.
 * @param name - The member that holds the time.
 * @returns One sentence when the member is given and is not a whole number of milliseconds a timer takes, else nothing.
 */
function timeProblems(definition: Record<string, unknown>, name: 'startTimeoutMs' | 'stopTimeoutMs'): readonly string[] {
  const value = definition[name]
  return value === undefined || (typeof value === 'number' && isInteger(value) && value >= 1 && value <= HOLD_MS)
    ? []
    : [`"${name}" must be a positive integer.`]
}

/**
 * Lists what is wrong with a service definition, before anything is installed or started for it.
 * The immutable section is not judged here: the build check and the freeze do that.
 *
 * @param value - What `runService` was given.
 * @returns One sentence per problem in a fixed order, none of which holds a value; empty for a definition that can be run.
 *
 * @example Judging a definition written without types
 * ```typescript
 * definitionProblems({ environment: defineEnvironment({}), start: 'listen', stopTimeoutMs: 0 })
 * // => ['"start" must be a function.', '"stopTimeoutMs" must be a positive integer.']
 * definitionProblems(null)
 * // => ['the definition must be an object.']
 * ```
 */
export function definitionProblems(value: unknown): readonly string[] {
  if (!isObject(value)) {
    return ['the definition must be an object.']
  }
  const environment = value['environment']
  return [
    ...(isObject(environment) && typeof environment['check'] === 'function' && typeof environment['load'] === 'function'
      ? []
      : ['"environment" must be an environment contract; build it with defineEnvironment().']),
    ...(typeof value['start'] === 'function' ? [] : ['"start" must be a function.']),
    ...timeProblems(value, 'startTimeoutMs'),
    ...timeProblems(value, 'stopTimeoutMs'),
  ]
}

/**
 * Reads a service definition once and judges it, before anything is installed or started for it.
 * Each member is read a single time, inside a guard, so a getter or a proxy trap that throws is a definition that cannot be run and never a rejection.
 *
 * @param value - What `runService` was given.
 * @returns The members to run with, or the fields and detail lines of the fatal block; it never throws.
 *
 * @example A definition that can be run and one whose section cannot be read
 * ```typescript
 * readDefinition({ environment: defineEnvironment({}), start: () => ({ close: async () => undefined }) }).stopTimeoutMs
 * // => 15000
 * readDefinition({ get immutable() { throw new RangeError('no') } }).fields
 * // => { name: 'RangeError' }
 * ```
 */
export function readDefinition<Shape extends EnvironmentShape>(value: unknown): DefinitionReading<Shape> {
  const refused = { service: null, startTimeoutMs: START_TIMEOUT_MS, stopTimeoutMs: STOP_TIMEOUT_MS, fields: {}, detail: [] }
  try {
    if (!isObject(value)) {
      return { ...refused, detail: listLines(definitionProblems(value)) }
    }
    const { environment, start, immutable, startTimeoutMs, stopTimeoutMs } = value
    const problems = definitionProblems({ environment, start, startTimeoutMs, stopTimeoutMs })
    if (problems.length > 0) {
      return { ...refused, detail: listLines(problems) }
    }
    return {
      service: { environment, start, immutable } as Pick<ServiceDefinition<Shape>, 'environment' | 'start' | 'immutable'>,
      startTimeoutMs: (startTimeoutMs as number | undefined) ?? START_TIMEOUT_MS,
      stopTimeoutMs: (stopTimeoutMs as number | undefined) ?? STOP_TIMEOUT_MS,
      fields: {},
      detail: [],
    }
  } catch (error) {
    return { ...refused, fields: { name: errorName(error) } }
  }
}

/**
 * Judges what a start function resolved to.
 *
 * @param value - Whatever the start function gave.
 * @returns `true` for an object with a `close` function and, when it has a port, an integer from 1 to 65535; it never throws.
 *
 * @example A listener, a job and a mistake
 * ```typescript
 * isStartedService({ port: 8080, close: async () => undefined }) // => true
 * isStartedService({ close: async () => undefined }) // => true
 * isStartedService({ port: 0, close: async () => undefined }) // => false
 * ```
 */
export function isStartedService(value: unknown): value is StartedService {
  try {
    if (isObject(value)) {
      const { close, port } = value
      return (
        typeof close === 'function' && (port === undefined || (typeof port === 'number' && isInteger(port) && port >= 1 && port <= 65535))
      )
    }
  } catch {
    // why: a getter or a proxy trap may throw while the value is read, and a value that cannot be read is unusable
  }
  return false
}
