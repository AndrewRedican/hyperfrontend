/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * Reads the command line of `generate <generator> [positionals] [--name=value ...] [--dry-run]`
 * against the generator's schema: positionals fill the options the schema takes from the argument
 * vector, flags are typed by the schema (an array from a comma-separated value), schema defaults
 * fill the rest, and a missing required option or a value outside an enumeration is refused.
 *
 * @module runner/generate
 */

import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { camelCase, readFlag } from './overrides'
import { refusal } from './refusal'

/** What the command line expects. */
export const GENERATE_USAGE = 'usage: hf generate <generator> [positional ...] [--name=value ...] [--dry-run]'

/** One option of a generator's schema, as far as the command line reads it. */
export interface GeneratorProperty {
  /** The JSON type. */
  readonly type?: string
  /** The value taken when none is given. */
  readonly default?: unknown
  /** The values allowed. */
  readonly enum?: readonly unknown[]
  /** Where the value comes from when no flag gives it: a positional of the command line. */
  readonly $default?: ArgvDefault
}

/** A schema's pointer from an option to a positional of the command line. */
export interface ArgvDefault {
  /** `argv` when the value is a positional. */
  readonly $source?: string
  /** The positional's index among the positionals, from 0. */
  readonly index?: number
}

/** A generator's schema, as far as the command line reads it. */
export interface GeneratorSchema {
  /** The options by name. */
  readonly properties?: Readonly<Record<string, GeneratorProperty>>
  /** The options that must be given. */
  readonly required?: readonly string[]
}

/** A generator call read from the command line. */
export interface GenerateRequest {
  /** The generator, as the command line names it. */
  readonly generator: string
  /** The options, typed and defaulted. */
  readonly options: Record<string, unknown>
  /** Whether the changes are printed rather than written. */
  readonly dryRun: boolean
}

/**
 * A flag's value typed by its schema property.
 *
 * @param name - The option, for the refusal
 * @param value - The value as written, true for a bare flag
 * @param property - The schema's property, when the schema has one
 * @returns The value in the type the schema names
 * @throws {Error} When the value does not fit the type or the enumeration
 */
function typedValue(name: string, value: string | true, property: GeneratorProperty | undefined): unknown {
  const type = property?.type
  let typed: unknown = value
  if (type === 'boolean') {
    if (value !== true && value !== 'true' && value !== 'false') throw refusal(`--${name} takes true or false, got ${value}`)
    typed = value !== 'false'
  } else if (value === true) {
    if (type !== undefined) throw refusal(`--${name} needs a value`)
  } else if (type === 'array') {
    typed = value.split(',').filter((entry) => entry !== '')
  }
  if (property?.enum !== undefined && !property.enum.includes(typed)) {
    throw refusal(`--${name} takes one of ${property.enum.map((entry) => stringify(entry)).join(', ')}, got ${stringify(typed)}`)
  }
  return typed
}

/**
 * Reads a generator call against its schema.
 *
 * @param argv - The arguments after `generate`
 * @param schema - Reads the schema of the generator a name means
 * @returns The generator, its options and whether to write
 * @throws {Error} When no generator is named, a positional has no option to fill, or an option is missing or invalid
 */
export function parseGenerateArgs(argv: readonly string[], schema: (generator: string) => GeneratorSchema): GenerateRequest {
  const [name, ...rest] = argv
  if (name === undefined || name.startsWith('-')) throw refusal('name the generator')
  const { properties = {}, required = [] } = schema(name)
  const positionals: string[] = []
  const options: Record<string, unknown> = {}
  let dryRun = false
  for (const arg of rest) {
    if (!arg.startsWith('-')) {
      positionals.push(arg)
      continue
    }
    const flag = readFlag(arg)
    const option = camelCase(flag.name)
    if (option === 'dryRun') dryRun = flag.value !== 'false'
    else options[option] = typedValue(option, flag.value, properties[option])
  }
  positionals.forEach((value, index) => {
    const option = entries(properties).find(([, property]) => property.$default?.$source === 'argv' && property.$default.index === index)
    if (option === undefined) throw refusal(`${name} takes no positional argument ${index + 1} (${value})`)
    if (!(option[0] in options)) options[option[0]] = typedValue(option[0], value, option[1])
  })
  for (const [option, property] of entries(properties)) {
    if (!(option in options) && property.default !== undefined)
      options[option] = isArray(property.default) ? [...property.default] : property.default
  }
  const missing = required.filter((option) => !(option in options))
  if (missing.length > 0) throw refusal(`${name} needs ${missing.map((option) => `--${option}`).join(', ')}`)
  return { generator: name, options, dryRun }
}
