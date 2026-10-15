import { label } from './label'

/**
 * Reads the label, so a spec sees whatever replacement is in force.
 *
 * @returns The label.
 */
export function greet(): string {
  return label()
}
