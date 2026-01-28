export function randomPowerLaw(alpha: number, min: number, max: number): number {
  const u = Math.random()
  const factor = (Math.pow(max, alpha - 1) - Math.pow(min, alpha - 1)) * u + Math.pow(min, alpha - 1)
  return Math.pow(factor, 1 / (alpha - 1))
}
