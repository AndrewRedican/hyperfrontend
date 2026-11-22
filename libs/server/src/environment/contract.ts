import type { Reader } from './readers'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze, fromEntries, getPrototypeOf, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** One environment variable: how it reads and whether it must be set. Built by `required` and `optional`. */
export interface Variable<Value> {
  /** The reader that parses and describes it. */
  readonly reader: Reader<Value>
  /** Whether an unset variable is an issue. */
  readonly required: boolean
  /** The value of an unset optional variable. */
  readonly fallback: Value | undefined
}

/**
 * Declares a variable that must be set: an unset one is reported as missing.
 *
 * @param reader - How the variable's text becomes a value.
 * @returns The frozen variable, to place under its name in a group.
 *
 * @example Requiring a greeting
 * ```typescript
 * import { asText, defineEnvironment, required } from '@hyperfrontend/server/environment'
 *
 * const environment = defineEnvironment({ hello: { HELLO_GREETING: required(asText()) } })
 * environment.check({})
 * // => [{ name: 'HELLO_GREETING', group: 'hello', problem: 'missing', expected: 'non-empty text' }]
 * ```
 */
export function required<Value>(reader: Reader<Value>): Variable<Value> {
  return freeze({ reader, required: true, fallback: undefined })
}

/**
 * Declares a variable that may be unset, with the value it then takes.
 * A set but malformed value is an issue, never the fallback.
 *
 * The fallback is handed back as given and does not pass through the reader.
 * A reader of secrets takes no fallback: the declaration is refused.
 *
 * @param reader - How the variable's text becomes a value.
 * @param fallback - The value of the variable when it is unset or empty.
 * @returns The frozen variable, to place under its name in a group.
 *
 * @example Falling back only when the variable is unset
 * ```typescript
 * import { asPort, defineEnvironment, optional } from '@hyperfrontend/server/environment'
 *
 * const environment = defineEnvironment({ http: { PORT: optional(asPort(), 8080) } })
 * environment.load({}).http.PORT // => 8080
 * environment.check({ PORT: 'eighty' })
 * // => [{ name: 'PORT', group: 'http', problem: 'malformed', expected: 'an integer between 1 and 65535' }]
 * ```
 */
export function optional<Value>(reader: Reader<Value>, fallback: Value): Variable<Value> {
  return freeze({ reader, required: false, fallback })
}

/** Groups of variables: the outer key is a group name, the inner key the environment variable's name. */
export type EnvironmentShape = Readonly<Record<string, Readonly<Record<string, Variable<unknown>>>>>

/** The values a shape loads to, under the same group and variable names. */
export type EnvironmentValues<Shape extends EnvironmentShape> = {
  readonly [Group in keyof Shape]: {
    readonly [Name in keyof Shape[Group]]: Shape[Group][Name] extends Variable<infer Value> ? Value : never
  }
}

/** An environment to read; `process.env` is one. */
export type EnvironmentRecord = Readonly<Record<string, string | undefined>>

/** One problem with one variable. It never carries a value. */
export interface EnvironmentIssue {
  /** The environment variable's name. */
  readonly name: string
  /** The group that declares it. */
  readonly group: string
  /** `missing` for an unset required variable, `malformed` for a set value its reader refuses. */
  readonly problem: 'missing' | 'malformed'
  /** The reader's `expected` phrase. */
  readonly expected: string
}

/** One declared variable, as data for documentation and build tooling. It never carries a value or a fallback. */
export interface VariableDescription {
  /** The environment variable's name. */
  readonly name: string
  /** The group that declares it. */
  readonly group: string
  /** Whether it must be set. */
  readonly required: boolean
  /** Whether it is a secret. */
  readonly secret: boolean
  /** The reader's `expected` phrase. */
  readonly expected: string
}

/** A declared environment: what a service reads, checked as a whole. */
export interface EnvironmentContract<Shape extends EnvironmentShape> {
  /** Every declared variable, in declaration order. */
  readonly variables: readonly VariableDescription[]
  /** Every issue in the environment, in declaration order; empty when it is valid. */
  check(env: EnvironmentRecord): readonly EnvironmentIssue[]
  /** All values, frozen, or one error whose message lists every issue. */
  load(env: EnvironmentRecord): EnvironmentValues<Shape>
}

/** One variable as the contract keeps it: what it declares, and how an environment's text becomes its value. */
interface Declaration {
  /** What the variable declares, as the contract lists it. */
  readonly description: VariableDescription
  /** The variable itself. */
  readonly variable: Variable<unknown>
}

/** A shape read once: its groups, its variables in declaration order, and everything wrong with it. */
interface Definition {
  /** The group names, in declaration order. */
  readonly groups: readonly string[]
  /** Every variable, in declaration order. */
  readonly declarations: readonly Declaration[]
  /** One sentence per fault of the shape. */
  readonly problems: readonly string[]
}

/** An environment read against the declarations: one value per declaration, and the issues found on the way. */
interface Reading {
  /** Every issue, in declaration order. */
  readonly issues: readonly EnvironmentIssue[]
  /** The value of each declaration, at the declaration's own position; meaningless once there is an issue. */
  readonly values: readonly unknown[]
}

// note: What an environment variable may be called: what every shell and every platform's settings page accepts.
const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*$/

// why: Taken from a literal so that no global is read for it; a group is plain when its prototype is this one or none.
const OBJECT_PROTOTYPE: unknown = getPrototypeOf({})

/**
 * Does nothing with a rejection.
 *
 * @returns Nothing.
 */
function ignore(): undefined {
  return undefined
}

/**
 * Tells an object from every other kind of value.
 *
 * @param value - The value to test.
 * @returns `true` for a non-null object.
 */
function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

/**
 * Tells a promise, or anything else that can be awaited, from a value a reader may hand back.
 *
 * @param value - What a reader returned.
 * @returns `true` when the value carries a `then` function.
 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null | undefined)?.then === 'function'
}

/**
 * Tells a plain object, one whose prototype is the default one or none, from an array, a map or an instance of a class.
 *
 * @param value - The value to test.
 * @returns `true` for an object literal and for an object made without a prototype.
 */
function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return false
  const prototype: unknown = getPrototypeOf(value)
  return prototype === null || prototype === OBJECT_PROTOTYPE
}

/**
 * Tells a variable from anything else a shape could hold, by its fields alone:
 * a reader a consumer wrote as a literal carries no mark to look for.
 *
 * @param value - What a group holds under one name.
 * @returns `true` when the value has the fields `required` and `optional` build.
 */
function isVariable(value: unknown): value is Variable<unknown> {
  if (!isRecord(value)) return false
  const variable: Partial<Record<keyof Variable<unknown>, unknown>> = value
  if (typeof variable.required !== 'boolean' || !isRecord(variable.reader)) return false
  const reader: Partial<Record<keyof Reader<unknown>, unknown>> = variable.reader
  return typeof reader.expected === 'string' && typeof reader.secret === 'boolean' && typeof reader.read === 'function'
}

/**
 * Reads a shape once, collecting its variables and every fault in declaration order.
 *
 * @param shape - The groups a service declared.
 * @returns The groups, the variables and the faults.
 */
function readDefinition(shape: EnvironmentShape): Definition {
  const problems: string[] = []
  const declarations: Declaration[] = []
  const firstGroups = createMap<string, string>()
  for (const group of keys(shape)) {
    const variables: unknown = shape[group]
    // why: Values come back under the group's name, and a property set under this one would replace the prototype of the values instead.
    if (group === '__proto__' || !isPlainObject(variables)) {
      problems.push(`${group}: a group must be a plain object of variables, and its name must not be "__proto__".`)
      continue
    }
    for (const name of keys(variables)) {
      const variable = variables[name]
      const declared = isVariable(variable)
      const firstGroup = firstGroups.get(name)
      if (!VARIABLE_NAME.test(name)) {
        problems.push(`${group}.${name}: a variable name must be upper-case letters, digits and "_", starting with a letter.`)
      }
      if (!declared) {
        problems.push(`${group}.${name}: not a variable; build it with required() or optional().`)
      }
      if (firstGroup === undefined) {
        firstGroups.set(name, group)
      } else {
        problems.push(`${name} is declared in "${firstGroup}" and in "${group}".`)
      }
      if (!declared) continue
      const { expected, secret } = variable.reader
      // why: A fallback is written in source, and a secret written in source is no secret.
      if (secret && !variable.required) {
        problems.push(`${name} (${group}) is a secret and cannot have a fallback.`)
      }
      declarations.push({ description: freeze({ name, group, required: variable.required, secret, expected }), variable })
    }
  }
  return { groups: keys(shape), declarations, problems }
}

/**
 * Asks a reader for the value of one raw text, treating everything but a plain result as a refusal.
 *
 * @param reader - The reader of the variable.
 * @param raw - The text the environment holds, untrimmed.
 * @returns The value, or `undefined` when the reader refused the text, threw, or returned a promise.
 */
function readValue(reader: Reader<unknown>, raw: string): unknown {
  try {
    const value = reader.read(raw)
    if (!isThenable(value)) return value
    // why: A reader is synchronous; a promise taken as the value would later reject unhandled, with a message that may quote the text.
    value.then(undefined, ignore)
    return undefined
  } catch {
    // why: What a reader throws may quote the text it was given, so only the refusal is kept.
    return undefined
  }
}

/**
 * Reads an environment against the declarations, in declaration order.
 *
 * @param declarations - The variables of the contract.
 * @param env - The environment to read.
 * @returns One value per declaration, and every issue found.
 */
function readEnvironment(declarations: readonly Declaration[], env: EnvironmentRecord): Reading {
  const issues: EnvironmentIssue[] = []
  const values = declarations.map(({ description, variable }) => {
    const { name, group, expected } = description
    const raw = env[name]
    if (raw === undefined || raw === '') {
      if (variable.required) issues.push(freeze({ name, group, problem: 'missing', expected }))
      return variable.fallback
    }
    const value = readValue(variable.reader, raw)
    if (value === undefined) issues.push(freeze({ name, group, problem: 'malformed', expected }))
    return value
  })
  return { issues: freeze(issues), values }
}

/**
 * Builds the one error a faulty environment is refused with.
 *
 * @param issues - What is wrong, in declaration order.
 * @returns An error named `EnvironmentError` whose message has a line per issue and no value.
 */
function environmentError(issues: readonly EnvironmentIssue[]): Error {
  const error = createError(
    [
      'Invalid environment:',
      ...issues.map((issue) => `  - ${issue.name} (${issue.group}) is ${issue.problem}; expected ${issue.expected}.`),
    ].join('\n')
  )
  error.name = 'EnvironmentError'
  return error
}

/**
 * Declares the environment a service reads, as groups of named variables.
 * Throws once, naming every malformed or repeated variable name and every secret declared optional.
 *
 * The contract reads no environment of its own: `check` and `load` take one,
 * so a service passes `process.env` and a test passes an object. `check`
 * returns every issue and never throws; `load` returns the frozen values or
 * throws one error named `EnvironmentError` with a line per issue. Neither an
 * issue nor the error ever holds a value, so both are safe to log.
 *
 * @param shape - The groups, each a plain object of variables keyed by environment variable name.
 * @returns The frozen contract: the declared variables as data, and the two ways to read an environment.
 * @throws {Error} When the shape has a faulty group, a faulty or repeated variable name, a value that is no variable, or a secret with a fallback.
 *
 * @example Loading a service's environment at boot
 * ```typescript
 * import { asPort, asSecret, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'
 *
 * const environment = defineEnvironment({
 *   http: { PORT: optional(asPort({ allowZero: true }), 8080), HOST: optional(asText(), '0.0.0.0') },
 *   hello: { HELLO_GREETING: required(asText()), HELLO_KEY: required(asSecret()) },
 * })
 *
 * const values = environment.load(process.env)
 * values.http.PORT // a number
 * values.hello.HELLO_KEY.reveal() // the key, which prints as '[secret]' everywhere else
 * ```
 *
 * @example Reporting every problem without a value in it
 * ```typescript
 * import { asPort, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'
 *
 * const environment = defineEnvironment({
 *   http: { PORT: optional(asPort(), 8080) },
 *   hello: { HELLO_GREETING: required(asText()) },
 * })
 *
 * environment.load({ PORT: 'eighty' })
 * // throws EnvironmentError:
 * // Invalid environment:
 * //   - PORT (http) is malformed; expected an integer between 1 and 65535.
 * //   - HELLO_GREETING (hello) is missing; expected non-empty text.
 * ```
 */
export function defineEnvironment<Shape extends EnvironmentShape>(shape: Shape): EnvironmentContract<Shape> {
  const { groups, declarations, problems } = readDefinition(shape)
  if (problems.length > 0) {
    throw createError(['Invalid environment definition:', ...problems.map((problem) => `  - ${problem}`)].join('\n'))
  }
  return freeze({
    variables: freeze(declarations.map(({ description }) => description)),
    check: (env: EnvironmentRecord) => readEnvironment(declarations, env).issues,
    load: (env: EnvironmentRecord) => {
      const { issues, values } = readEnvironment(declarations, env)
      if (issues.length > 0) throw environmentError(issues)
      const grouped = groups.map((group) => {
        const members = declarations.flatMap(({ description }, index) =>
          description.group === group ? [[description.name, values[index]]] : []
        )
        return [group, freeze(fromEntries(members))]
      })
      return freeze(fromEntries(grouped)) as EnvironmentValues<Shape>
    },
  })
}
