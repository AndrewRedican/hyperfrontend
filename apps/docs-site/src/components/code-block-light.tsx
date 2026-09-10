'use client'

import { attachPointerLight } from '@/lib/code-block-dom'
import { useEffect } from 'react'

/**
 * Lights code blocks from the pointer, everywhere on the site.
 *
 * Mounted once in the root layout rather than by each page that happens to show
 * code, because the listener is on the document and knows a block when the
 * pointer reaches one. Code samples are written into pages three different
 * ways here (a component, a rendered README, a rendered guide) and this way
 * none of them has to remember to opt in.
 *
 * It renders nothing. On a coarse pointer, or for a visitor who has asked for
 * less motion, it attaches nothing either.
 * @returns Nothing; this component exists for its effect.
 */
export function CodeBlockLight() {
  useEffect(() => attachPointerLight(), [])
  return null
}
