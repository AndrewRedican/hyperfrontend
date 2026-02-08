import type { DataType, IterableOperators, RegisteredIterableClassEntry } from './models'
import { registeredIterableClasses } from './shared/consts'

export const getIterableOperators = <T extends string = DataType>(dataType: T): IterableOperators => {
  const { getKeys, read, write, remove, instantiate } = <RegisteredIterableClassEntry<unknown>>(
    registeredIterableClasses.find((e) => e.classRef.name.toLowerCase() === dataType.toLowerCase())
  )
  return { getKeys, read, write, remove, instantiate }
}
