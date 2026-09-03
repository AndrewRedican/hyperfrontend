import type { Schema, ValidationResult } from '@hyperfrontend/json-utils'
import type { ActionDescription, DisplayConfig, FeatureConfig, FeatureContract } from './types'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { validate } from '@hyperfrontend/json-utils'
import { parseVersion } from '@hyperfrontend/versioning/semver/parse'
import { DisplayMode } from './types'

// note: Mirrors the BoxPosition union; validation reports the allowed values by listing this.
const BOX_POSITIONS: readonly string[] = [
  'center',
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

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
    if (action['required'] !== undefined && typeof action['required'] !== 'boolean') {
      issues.push(`"${field}[${index}]" has a "required" that must be a boolean.`)
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
 * Collects any problem with the contract's optional `version` field.
 *
 * @param version - The candidate version value.
 * @param issues - The running list of human-readable problems, appended to in place.
 */
function collectVersionIssues(version: unknown, issues: string[]): void {
  if (version === undefined) {
    return
  }
  if (typeof version !== 'string') {
    issues.push(`"version" must be a semver string, but got ${describeType(version)}.`)
    return
  }
  if (!parseVersion(version).success) {
    issues.push(`"version" must be a valid semver version (e.g. "1.2.0"), but got "${version}".`)
  }
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
 * @throws {Error} When the value is not an object, any action is malformed, a `respondsWith` names no action in the other direction, or a `version` is not valid semver.
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
  collectVersionIssues(contract['version'], issues)
  if (issues.length === 0) {
    const emitted = contract['emitted'] as ActionDescription[]
    const accepted = contract['accepted'] as ActionDescription[]
    collectRespondsWithIssues(emitted, 'emitted', accepted, 'accepted', issues)
    collectRespondsWithIssues(accepted, 'accepted', emitted, 'emitted', issues)
  }
  if (issues.length > 0) {
    throw createError(`Invalid contract:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`)
  }
  return {
    emitted: contract['emitted'] as ActionDescription[],
    accepted: contract['accepted'] as ActionDescription[],
    ...(contract['version'] !== undefined && { version: contract['version'] as string }),
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
  const fields = ['name', 'version', 'contract'] as const
  fields.forEach((field) => {
    if (typeof config[field] !== 'string' || (config[field] as string).length === 0) {
      throw createError(`Invalid config: "${field}" must be a non-empty string.`)
    }
  })
  return config as unknown as FeatureConfig
}

/**
 * Collects any problem with a per-mode dimension pair (`width`/`height`).
 *
 * @param section - The candidate per-mode record.
 * @param field - The config path of `section`, used to locate problems in messages.
 * @param bothRequired - Whether the pair must be complete (fixed embedded sizing).
 * @param issues - The running list of human-readable problems, appended to in place.
 */
function collectDimensionIssues(section: Record<string, unknown>, field: string, bothRequired: boolean, issues: string[]): void {
  const axes = ['width', 'height'] as const
  if (bothRequired && axes.some((axis) => section[axis] === undefined)) {
    issues.push(`"${field}" must declare both "width" and "height" — fixed dimensions are exact, so a partial pair is meaningless.`)
  }
  axes.forEach((axis) => {
    const value = section[axis]
    if (value === undefined) {
      return
    }
    if (typeof value !== 'number' || !(value > 0) || value === Infinity) {
      issues.push(`"${field}.${axis}" must be a positive number of pixels.`)
    }
  })
}

/**
 * Collects any problem with the config's `display.modes` list.
 *
 * @param modes - The candidate modes value.
 * @param issues - The running list of human-readable problems, appended to in place.
 * @returns The validated modes list, or `undefined` when absent or invalid.
 */
function collectModesIssues(modes: unknown, issues: string[]): DisplayMode[] | undefined {
  if (modes === undefined) {
    return undefined
  }
  const known = values(DisplayMode)
  if (!isArray(modes) || modes.length === 0) {
    issues.push(`"display.modes" must be a non-empty array of display modes (${known.join(', ')}).`)
    return undefined
  }
  const unknown = modes.filter((mode) => !known.includes(mode as DisplayMode))
  if (unknown.length > 0) {
    issues.push(
      `"display.modes" contains unknown modes: ${unknown.map((mode) => `"${String(mode)}"`).join(', ')} (expected ${known.join(', ')}).`
    )
    return undefined
  }
  if (modes.some((mode, index) => modes.indexOf(mode) !== index)) {
    issues.push('"display.modes" must not repeat a mode.')
    return undefined
  }
  return modes as DisplayMode[]
}

/**
 * Validates an unknown value as a {@link DisplayConfig}.
 *
 * Enforces the presentation agreement a feature declares: a well-formed
 * (deduplicated, known) `modes` list, complete positive fixed embedded
 * dimensions, positive dialog/popup dimensions, a known backdrop behavior, and
 * per-mode sections that only configure declared modes. Reports every problem
 * at once.
 *
 * @param display - The candidate `display` value from a feature config.
 * @returns The validated display config, typed.
 * @throws {Error} When any part of the display config is malformed.
 *
 * @example Validating a display declaration
 * ```typescript
 * const display = validateDisplayConfig({ modes: ['embedded', 'dialog'], dialog: { width: 480, backdrop: 'event' } })
 * ```
 */
export function validateDisplayConfig(display: unknown): DisplayConfig {
  if (!isRecord(display)) {
    throw createError(`Invalid config: "display" must be an object, but got ${describeType(display)}.`)
  }
  const issues: string[] = []
  const modes = collectModesIssues(display['modes'], issues)
  const sections = ['embedded', 'dialog', 'popup'] as const
  sections.forEach((section) => {
    const value = display[section]
    if (value === undefined) {
      return
    }
    if (!isRecord(value)) {
      issues.push(`"display.${section}" must be an object, but got ${describeType(value)}.`)
      return
    }
    if (modes !== undefined && !modes.includes(section)) {
      issues.push(
        `"display.${section}" is configured, but "${section}" is not in "display.modes" — declare the mode or drop its configuration.`
      )
    }
    collectDimensionIssues(value, `display.${section}`, section === 'embedded', issues)
    const position = value['position']
    if (section !== 'embedded' && position !== undefined && !(typeof position === 'string' && BOX_POSITIONS.includes(position))) {
      issues.push(
        `"display.${section}.position" must be one of ${BOX_POSITIONS.join(', ')}, but got ${typeof position === 'string' ? `"${position}"` : describeType(position)}.`
      )
    }
    if (section === 'dialog') {
      const backdrop = value['backdrop']
      if (backdrop !== undefined && backdrop !== 'close' && backdrop !== 'event' && backdrop !== 'none') {
        issues.push(
          `"display.dialog.backdrop" must be "close", "event", or "none", but got ${typeof backdrop === 'string' ? `"${backdrop}"` : describeType(backdrop)}.`
        )
      }
    }
  })
  if (display['closeOnEscape'] !== undefined && typeof display['closeOnEscape'] !== 'boolean') {
    issues.push(`"display.closeOnEscape" must be a boolean, but got ${describeType(display['closeOnEscape'])}.`)
  }
  if (issues.length > 0) {
    throw createError(`Invalid config:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`)
  }
  return display as DisplayConfig
}

/**
 * Validates a message payload against an action's optional schema at runtime.
 *
 * This check runs on both ends of the feature channel — in the host shell (and
 * therefore in every generated shell, which bundles it) and in the hostee
 * feature handle — with each side judging by its own contract: an outgoing
 * payload is validated against the sender's `emitted` schemas and an invalid
 * send throws in the sender's frame before anything crosses the wire; an
 * incoming payload is validated against the receiver's `accepted` schemas and
 * an invalid message is dropped and surfaced as an `error` event with reason
 * `'invalid-payload'`. Type-only actions (those without a `schema`) always
 * pass.
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
  return validate(payload, action.schema as Schema)
}
