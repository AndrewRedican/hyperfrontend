/**
 * Detects whether the current device is a mobile device based on the user agent.
 *
 * @returns True if the device is mobile, false otherwise
 */
export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
}
