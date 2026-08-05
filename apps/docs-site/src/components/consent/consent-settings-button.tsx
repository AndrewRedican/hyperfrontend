'use client'

import { GA_MEASUREMENT_ID } from '@/lib/analytics'
import { openConsentPreferences } from '@/lib/consent/consent-ui'

/** Props for {@link ConsentSettingsButton}. */
export interface ConsentSettingsButtonProps {
  /** Extra classes for the button element. */
  className?: string
}

/**
 * The persistent way back into the consent preferences dialog. Renders
 * nothing while the measurement integration is dormant (no ID configured) —
 * there is no optional tracking to manage, so a settings entry would only
 * mislead.
 * @param props - The {@link ConsentSettingsButtonProps}.
 * @param props.className - Extra classes for the button element.
 * @returns The reopen button, or `null` while dormant.
 */
export function ConsentSettingsButton({ className }: ConsentSettingsButtonProps) {
  if (!GA_MEASUREMENT_ID) {
    return null
  }
  return (
    <button type="button" className={className} onClick={openConsentPreferences}>
      Privacy settings
    </button>
  )
}
