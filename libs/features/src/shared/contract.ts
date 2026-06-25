import type { ActionDescription, FeatureConfig, FeatureContract } from './types'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

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
 * Validates a single action list (`emitted` or `accepted`) from a contract.
 *
 * @param actions - The candidate action list.
 * @param field - The field name, used in error messages.
 * @returns The validated, typed action list.
 */
function validateActionList(actions: unknown, field: string): ActionDescription[] {
  if (!isArray(actions)) {
    throw createError(`Invalid contract: "${field}" must be an array.`)
  }
  actions.forEach((action, index) => {
    if (!isRecord(action) || typeof action['type'] !== 'string' || action['type'].length === 0) {
      throw createError(`Invalid contract: "${field}[${index}]" must have a non-empty string "type".`)
    }
  })
  return <ActionDescription[]>actions
}

/**
 * Validates an unknown value as a {@link FeatureContract}.
 *
 * @param contract - The candidate contract, typically parsed from disk.
 * @returns The validated contract, typed.
 *
 * @example Validating a parsed contract file
 * ```typescript
 * const contract = validateContract(parse(readFileSync('clock.contract.json', 'utf8')))
 * contract.emitted.forEach((action) => console.log(action.type))
 * ```
 */
export function validateContract(contract: unknown): FeatureContract {
  if (!isRecord(contract)) {
    throw createError('Invalid contract: expected an object with "emitted" and "accepted" arrays.')
  }
  return {
    emitted: validateActionList(contract['emitted'], 'emitted'),
    accepted: validateActionList(contract['accepted'], 'accepted'),
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
