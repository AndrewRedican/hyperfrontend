'use client'

import { trackEvent } from '@/lib/analytics'
import { consentStore } from '@/lib/consent/consent'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Fires a GA4 `page_view` exactly once per viewed path — on load, on every
 * client-side route change, and, for the path currently on screen, the moment
 * the visitor grants analytics consent mid-visit. Required because the gtag
 * config disables automatic page views (`send_page_view: false`) and App
 * Router navigations never reload the document; pre-consent views are simply
 * never sent — consent is not retroactive.
 */
export function RouteTracker() {
  const pathname = usePathname()

  useEffect(() => {
    let fired = false
    const attempt = () => {
      if (fired || !consentStore.isGranted('analytics')) {
        return
      }
      fired = true
      trackEvent('page_view', {
        page_path: pathname,
        page_location: window.location.href,
        page_title: document.title,
      })
    }
    attempt()
    return consentStore.subscribe(attempt)
  }, [pathname])

  return null
}
