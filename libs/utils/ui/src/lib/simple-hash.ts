export function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  let hashStr = (hash & 0xffffffff).toString(36)
  if (hashStr.length > 6) {
    hashStr = hashStr.substr(0, 6)
  } else {
    hashStr = hashStr.padEnd(6, '0')
  }
  return hashStr
}
