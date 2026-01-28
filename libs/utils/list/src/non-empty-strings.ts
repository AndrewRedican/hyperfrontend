export function nonEmptyStrings(values: string[]): string[] {
  return values.filter((value) => ![undefined, null, ''].includes(value) && value.trim() !== '')
}
