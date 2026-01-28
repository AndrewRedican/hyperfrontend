export function setIntervalCallback(callback: () => void, interval: number): () => void {
  const timerId: NodeJS.Timeout = setInterval(callback, interval)
  return (): void => clearInterval(timerId)
}
