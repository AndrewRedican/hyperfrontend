import { defineProperties } from '../built-in-copy/object'
import { lockedPropertyDescriptors } from './locked-prop-descriptors'

export type PropertyLock = (
  object: object,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  propertyValuePairs: [string, any][]
) => void

export const lockedProps: PropertyLock = (object, propertyValuePairs) => {
  const propertyMap: PropertyDescriptorMap = {}
  propertyValuePairs.forEach(([key, value]) => (propertyMap[key] = lockedPropertyDescriptors(value)))
  defineProperties(object, propertyMap)
}
