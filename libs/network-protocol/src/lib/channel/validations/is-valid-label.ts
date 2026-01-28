import { getType } from '@hyperfrontend/data-utils'

export function isValidLabel(label: string) {
  return getType(label) === 'string' && label.length > 0
}
