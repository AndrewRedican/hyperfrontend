import { label, untouched } from './label'

/**
 * Reads both exports of the module a spec replaces, so the replacement is observed from
 * a consumer rather than only from the spec's own import.
 *
 * @returns The label and the untouched value, joined.
 */
export function greet(): string {
  return `${label()}/${untouched()}`
}
