// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getLastKeyInMap = <K = any>(map: Map<K, any>): K => {
  const items = [...map.keys()]
  return items[items.length - 1] as K
}
