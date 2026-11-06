/**
 * The options a command line passes after the task: `--name=value` sets an option and a bare
 * `--name` sets it to true. A kebab-case name becomes camelCase, and a value is read as the type
 * the executor's schema declares for the option.
 *
 * @module runner/overrides
 */

import type { ExecutorSchema } from './executors'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { refusal } from './refusal'

/** One option a command line passes. */
export interface Flag {
  /** The name as written, without the leading dashes. */
  readonly name: string
  /** The value as written, or true for a bare flag. */
  readonly value: string | true
}

/** The options a command line passes after the task. */
export interface Overrides {
  /** The options by camelCase name, values as written. */
  readonly options: Readonly<Record<string, string | true>>
  /** The arguments as written, in order. */
  readonly args: readonly string[]
}

/**
 * The camelCase form of an option name: a name with a dash after its second character is
 * lower-cased and every dash folds into an upper-case letter; any other name stays as written.
 *
 * @param name - The name as written
 * @returns The camelCase name
 */
export function camelCase(name: string): string {
  return name.indexOf('-') > 1 ? name.toLowerCase().replace(/-(.)/g, (_, letter: string) => letter.toUpperCase()) : name
}

/**
 * Reads one argument as an option.
 *
 * @param arg - The argument, `--name=value` or `--name`
 * @returns The option
 * @throws {Error} When the argument is not written as an option
 */
export function readFlag(arg: string): Flag {
  const body = arg.startsWith('--') ? arg.slice(2) : ''
  const equals = body.indexOf('=')
  const name = equals === -1 ? body : body.slice(0, equals)
  if (name === '' || name.startsWith('-')) throw refusal(`expected --name=value or --name after the task, got ${arg}`)
  return { name, value: equals === -1 ? true : body.slice(equals + 1) }
}

/**
 * The options of the arguments after the task.
 *
 * @param args - The arguments
 * @returns The options and the arguments as written
 * @throws {Error} When an argument is not written as an option
 */
export function parseOverrides(args: readonly string[]): Overrides {
  const options: Record<string, string | true> = {}
  for (const arg of args) {
    const flag = readFlag(arg)
    options[camelCase(flag.name)] = flag.value
  }
  return { options, args: [...args] }
}

/**
 * One option as the type its schema declares: a boolean reads true or false, a number reads a
 * number, a string or an undeclared option keeps its text, and a bare flag is true only for a
 * boolean or an undeclared option.
 *
 * @param name - The option's camelCase name
 * @param value - The value as written, or true for a bare flag
 * @param type - The JSON type the schema declares, or undefined
 * @returns The value read as the declared type
 * @throws {Error} When the value does not read as the declared type, or the type cannot be written on a command line
 */
function typedValue(name: string, value: string | true, type: string | undefined): unknown {
  if (type === 'boolean') {
    if (value === true || value === 'true') return true
    if (value === 'false') return false
    throw refusal(`--${name} takes true or false, got ${value}`)
  }
  if (value === true) {
    if (type === undefined) return true
    throw refusal(`--${name} needs a value`)
  }
  if (type === 'number' || type === 'integer') {
    const number = Number(value)
    if (value.trim() === '' || !isFinite(number)) throw refusal(`--${name} takes a number, got ${value}`)
    return number
  }
  if (type === 'array' || type === 'object') throw refusal(`--${name} cannot be set from the command line`)
  return value
}

/**
 * The options of a command line typed by the executor's schema.
 *
 * @param options - The options by camelCase name, values as written
 * @param schema - The executor's options schema
 * @returns The options with each value read as its declared type
 * @throws {Error} When a value does not read as its declared type
 */
export function typedOverrides(options: Readonly<Record<string, string | true>>, schema: ExecutorSchema): Record<string, unknown> {
  const typed: Record<string, unknown> = {}
  for (const [name, value] of entries(options)) typed[name] = typedValue(name, value, schema.properties?.[name]?.type)
  return typed
}
