import { getType } from '@hyperfrontend/data-utils'

export function isValidRefreshRate(refreshRate: number) {
  return getType(refreshRate) === 'number' && refreshRate >= 1
}
