'use client'

import { trackEvent } from '@/lib/analytics'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Fires a GA4 `page_view` event on the initial load and again on every
 * client-side route change. Required because the gtag config disables
 * automatic page views (`send_page_view: false`) and App Router navigations
 * never reload the document.
 */
export function RouteTracker() {
  const pathname = usePathname()

  useEffect(() => {
    trackEvent('page_view', {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [pathname])

  return null
}
