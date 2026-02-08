export const isMarker = (text: string): boolean => {
  if (typeof text !== 'string' || !text.startsWith('__$')) return false
  return /^__\$[0-9]+$/.test(text)
}
