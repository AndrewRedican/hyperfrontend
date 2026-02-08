export type Callback = () => void

/**
 * Creates a gesture listener that detects mouse/touch interactions and keyboard events with a cleanup function.
 *
 * @param callback - The function to execute when a gesture is detected (Escape key or pinch gesture)
 * @returns A cleanup function to remove all event listeners
 */
export function createGestureListener(callback: Callback) {
  let initialDistance: number | null = null

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      callback()
    }
  }

  const handleTouchStart = (event: TouchEvent): void => {
    /* istanbul ignore else */
    if (event.touches.length >= 2) {
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      initialDistance = getDistance(touch1, touch2)
    }
  }

  const handleTouchMove = (event: TouchEvent): void => {
    if (event.touches.length >= 2 && initialDistance !== null) {
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      const currentDistance = getDistance(touch1, touch2)

      if (currentDistance > initialDistance) {
        callback()
        initialDistance = null
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTouchEnd = (_: TouchEvent): void => {
    initialDistance = null
  }

  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('touchstart', handleTouchStart)
  document.addEventListener('touchmove', handleTouchMove)
  document.addEventListener('touchend', handleTouchEnd)

  // Return a function to remove event listeners
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('touchstart', handleTouchStart)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
  }
}
