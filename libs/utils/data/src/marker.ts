import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { random, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

export const marker = (): string => {
  const randomValue = round(random() * 10000000000000)
  const sequential = createDate().getTime()
  const unique = `${randomValue}${sequential}`
  const prefix = `__$`
  return `${prefix}${unique}`
}
