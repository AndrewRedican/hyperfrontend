export function pause(timeMS: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise((resolve, _) => setTimeout(() => resolve(void 0), timeMS))
}
