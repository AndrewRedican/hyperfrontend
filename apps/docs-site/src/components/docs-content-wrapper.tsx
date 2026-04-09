'use client'

import type { ReactNode } from 'react'
import { useHashNavigation } from '../hooks/use-hash-navigation'

interface DocsContentWrapperProps {
  children: ReactNode
}

/**
 * A wrapper component for docs pages that enables hash navigation.
 * Automatically scrolls to the anchored section on page load and hash changes.
 * @param root0
 * @param root0.children
 * @example
 * ```tsx
 * export default function DocsPage() {
 *   return (
 *     <DocsContentWrapper>
 *       <H1>Getting Started</H1>
 *       <section>
 *         <H2>Installation</H2>
 *         ...
 *       </section>
 *     </DocsContentWrapper>
 *   )
 * }
 * ```
 */
export function DocsContentWrapper({ children }: DocsContentWrapperProps) {
  useHashNavigation()

  return <>{children}</>
}
