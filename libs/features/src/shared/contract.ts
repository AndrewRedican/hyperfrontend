import type { Schema, ValidationResult } from '@hyperfrontend/json-utils'
import type { ActionDescription, FeatureConfig, FeatureContract } from './types'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { validate } from '@hyperfrontend/json-utils'

// note: Runtime validation shared by the host/hostee factories and the config loader.

/**
 * Narrows an unknown value to a non-null object.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Collects every problem with a single action list (`emitted` or `accepted`).
 *
 * Each malformed entry contributes its own message, distinguishing a non-object
 * entry from one missing a usable `type`, so the caller can report them all at once.
 *
 * @param actions - The candidate action list.
 * @param field - The field name, used to locate problems in messages.
 * @param issues - The running list of human-readable problems, appended to in place.
 */
function collectActionListIssues(actions: unknown, field: string, issues: string[]): void {
  if (!isArray(actions)) {
    issues.push(`"${field}" must be an array.`)
    return
  }
  actions.forEach((action, index) => {
    if (!isRecord(action)) {
      issues.push(`"${field}[${index}]" must be an object, but got ${describeType(action)}.`)
      return
    }
    if (typeof action['type'] !== 'string' || action['type'].length === 0) {
      issues.push(`"${field}[${index}]" must have a non-empty string "type".`)
    }
    if (action['respondsWith'] !== undefined && (typeof action['respondsWith'] !== 'string' || action['respondsWith'].length === 0)) {
      issues.push(`"${field}[${index}]" has a "respondsWith" that must be a non-empty string.`)
    }
  })
}

/**
 * Collects every `respondsWith` reference that does not name an action in the other direction.
 *
 * A request emitted by one side is answered by an action the same side accepts (and
 * vice versa), so each `respondsWith` must resolve across the contract's directions.
 *
 * @param actions - The already well-formed action list to check.
 * @param field - The field name of `actions`, used to locate problems in messages.
 * @param other - The action list of the opposite direction.
 * @param otherField - The field name of `other`, used in messages.
 * @param issues - The running list of human-readable problems, appended to in place.
 */
function collectRespondsWithIssues(
  actions: ActionDescription[],
  field: string,
  other: ActionDescription[],
  otherField: string,
  issues: string[]
): void {
  actions.forEach((action, index) => {
    if (action.respondsWith === undefined) {
      return
    }
    if (!other.some((candidate) => candidate.type === action.respondsWith)) {
      issues.push(`"${field}[${index}]" responds with "${action.respondsWith}", but "${otherField}" has no action of that type.`)
    }
  })
}

/**
 * Names the kind of an unexpected value for an error message.
 *
 * @param value - The value to describe.
 * @returns A short label such as `null`, `an array`, or `a number`.
 */
function describeType(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (isArray(value)) {
    return 'an array'
  }
  return `a ${typeof value}`
}

/**
 * Validates an unknown value as a {@link FeatureContract}.
 *
 * Reports every malformed action at once rather than stopping at the first, so a
 * single error message lists all the problems to fix.
 *
 * @param contract - The candidate contract, typically parsed from disk.
 * @returns The validated contract, typed.
 * @throws {Error} When the value is not an object, any action is malformed, or a `respondsWith` names no action in the other direction.
 *
 * @example Validating a parsed contract file
 * ```typescript
 * const contract = validateContract(parse(readFileSync('clock.contract.json', 'utf8')))
 * contract.emitted.forEach((action) => console.log(action.type))
 * ```
 */
export function validateContract(contract: unknown): FeatureContract {
  if (!isRecord(contract)) {
    throw createError(`Invalid contract: expected an object with "emitted" and "accepted" arrays, but got ${describeType(contract)}.`)
  }
  const issues: string[] = []
  collectActionListIssues(contract['emitted'], 'emitted', issues)
  collectActionListIssues(contract['accepted'], 'accepted', issues)
  if (issues.length === 0) {
    const emitted = <ActionDescription[]>contract['emitted']
    const accepted = <ActionDescription[]>contract['accepted']
    collectRespondsWithIssues(emitted, 'emitted', accepted, 'accepted', issues)
    collectRespondsWithIssues(accepted, 'accepted', emitted, 'emitted', issues)
  }
  if (issues.length > 0) {
    throw createError(`Invalid contract:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`)
  }
  return {
    emitted: <ActionDescription[]>contract['emitted'],
    accepted: <ActionDescription[]>contract['accepted'],
  }
}

/**
 * Validates an unknown value as a resolved {@link FeatureConfig}.
 *
 * @param config - The candidate config object, typically from a loader or flags.
 * @returns The validated config, typed.
 *
 * @example Validating a resolved config object
 * ```typescript
 * const config = validateFeatureConfig({ name: 'clock', version: '1.0.0', contract: './clock.contract.json' })
 * console.log(config.name)
 * ```
 */
export function validateFeatureConfig(config: unknown): FeatureConfig {
  if (!isRecord(config)) {
    throw createError('Invalid config: expected an object.')
  }
  const fields = <const>['name', 'version', 'contract']
  fields.forEach((field) => {
    if (typeof config[field] !== 'string' || (<string>config[field]).length === 0) {
      throw createError(`Invalid config: "${field}" must be a non-empty string.`)
    }
  })
  return <FeatureConfig>(<unknown>config)
}

/**
 * Validates a message payload against an action's optional schema at runtime.
 *
 * Bundled into the generated connector and used on both the host and hostee
 * sides. Type-only actions (those without a `schema`) always pass.
 *
 * @param action - The contract action whose schema the payload must satisfy.
 * @param payload - The candidate message payload.
 * @returns A validation result with `valid` and any schema `errors`.
 *
 * @example Validating a `setTimezone` payload
 * ```typescript
 * const result = validatePayload({ type: 'setTimezone', schema: { type: 'object' } }, { tz: 'UTC' })
 * if (!result.valid) throw createError(result.errors[0].message)
 * ```
 */
export function validatePayload(action: ActionDescription, payload: unknown): ValidationResult {
  if (action.schema === undefined) {
    return { valid: true, errors: [] }
  }
  return validate(payload, <Schema>action.schema)
}
