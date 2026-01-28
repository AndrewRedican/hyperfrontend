export function randomLogarithmic(scale: number): number {
  const u = Math.random()
  return Math.exp(scale * u)
}
