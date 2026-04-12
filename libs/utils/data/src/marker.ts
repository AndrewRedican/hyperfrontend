import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { random, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a unique marker string for object tagging.
 *
 * @returns A unique marker string prefixed with __$
 *
 * @example Generating unique marker
 * ```typescript
 * const tag = marker() // '__$16789012345001234567890'
 * ```
 */
export const marker = (): string => {
  const randomValue = round(random() * 10000000000000)
  const sequential = createDate().getTime()
  const unique = `${randomValue}${sequential}`
  const prefix = `__$`
  return `${prefix}${unique}`
}
