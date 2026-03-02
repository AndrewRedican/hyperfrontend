import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'

export const marker = (): string => {
  const random = Math.round(Math.random() * 10000000000000)
  const sequential = createDate().getTime()
  const unique = `${random}${sequential}`
  const prefix = `__$`
  return `${prefix}${unique}`
}
