export function createRange(start: number, end: number): number[] {
  const range: number[] = []
  for (let i = start; i <= end; i += 1) {
    range.push(i)
  }
  return range
}
