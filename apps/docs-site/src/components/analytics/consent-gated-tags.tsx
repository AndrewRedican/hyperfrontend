'use client'

import { GA_MEASUREMENT_ID, applyConsentToGoogleTags, shouldLoadGoogleTag } from '@/lib/analytics'
import { consentStore } from '@/lib/consent/consent'
import Script from 'next/script'
import { useEffect, useState } from 'react'

/**
 * The single place consent decisions reach the Google layer. It watches the
 * consent store, pushes every decision as a Consent Mode v2 update (including
 * withdrawals, which stop future optional collection), configures granted
 * tags, and — the basic-mode point — only mounts the gtag.js library once an
 * optional category has actually been granted. Before that, the page carries
 * no Google script and makes no Google request.
 */
export function ConsentGatedTags() {
  const [loadTag, setLoadTag] = useState(false)

  useEffect(() => {
    const apply = () => {
      const decision = consentStore.getDecision()
      applyConsentToGoogleTags(decision)
      if (shouldLoadGoogleTag(decision)) {
        setLoadTag(true)
      }
    }
    // why: A decision persisted on an earlier visit must apply on load, not only on change.
    apply()
    return consentStore.subscribe(apply)
  }, [])

  if (!loadTag || !GA_MEASUREMENT_ID) {
    return null
  }
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
}
