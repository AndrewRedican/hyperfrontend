export function randomExponential(lambda: number): number {
  const u = Math.random()
  return -Math.log(1 - u) / lambda
}
