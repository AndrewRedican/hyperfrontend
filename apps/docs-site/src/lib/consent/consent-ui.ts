/** The window event that asks the consent banner to open its preferences dialog. */
export const CONSENT_PREFERENCES_EVENT = 'hf:consent-preferences-open'

/**
 * Asks the mounted consent UI to open the preferences dialog.
 */
export function openConsentPreferences(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new Event(CONSENT_PREFERENCES_EVENT))
}
