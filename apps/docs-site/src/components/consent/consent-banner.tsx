'use client'

import { GA_MEASUREMENT_ID } from '@/lib/analytics'
import { consentStore } from '@/lib/consent/consent'
import { CONSENT_PREFERENCES_EVENT } from '@/lib/consent/consent-ui'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Shared styling for the two decision buttons — accepting and rejecting carry identical visual weight. */
const DECISION_BUTTON_CLASSES =
  'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'

/** Styling for the secondary manage/close controls. */
const QUIET_BUTTON_CLASSES =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:text-primary-400'

/**
 * The consent experience: a first-visit banner with equally prominent
 * accept/reject choices plus a preferences dialog with separate analytics and
 * advertising controls, nothing preselected. It renders only when a
 * measurement ID is configured — while the integration is dormant there is
 * nothing to consent to, so no banner appears; configuring an ID activates
 * this experience automatically. The dialog stays reachable for the life of
 * the page through {@link CONSENT_PREFERENCES_EVENT}, so choices can always
 * be changed or withdrawn.
 */
export function ConsentBanner() {
  const [decided, setDecided] = useState(true)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [analyticsChoice, setAnalyticsChoice] = useState(false)
  const [advertisingChoice, setAdvertisingChoice] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const reopenerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // why: The banner's visibility depends on client storage, so the server render assumes "decided" and the truth lands after mount — no flash for returning visitors.
    const sync = () => setDecided(consentStore.hasDecision())
    sync()
    return consentStore.subscribe(sync)
  }, [])

  const openPreferences = useCallback(() => {
    const decision = consentStore.getDecision()
    setAnalyticsChoice(decision?.analytics ?? false)
    setAdvertisingChoice(decision?.advertising ?? false)
    reopenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPreferencesOpen(true)
  }, [])

  useEffect(() => {
    window.addEventListener(CONSENT_PREFERENCES_EVENT, openPreferences)
    return () => window.removeEventListener(CONSENT_PREFERENCES_EVENT, openPreferences)
  }, [openPreferences])

  useEffect(() => {
    if (!preferencesOpen) {
      return
    }
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreferencesOpen(false)
        reopenerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [preferencesOpen])

  if (!GA_MEASUREMENT_ID) {
    return null
  }

  const closePreferences = () => {
    setPreferencesOpen(false)
    reopenerRef.current?.focus()
  }

  const decide = (analytics: boolean, advertising: boolean) => {
    consentStore.decide({ analytics, advertising })
    setPreferencesOpen(false)
  }

  return (
    <>
      {!decided && !preferencesOpen ? (
        <div
          role="region"
          aria-label="Privacy choices"
          className="fixed inset-x-0 bottom-0 z-[140] border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This site uses optional analytics and advertising measurement only with your consent. Nothing optional runs until you allow
              it.{' '}
              <Link href="/privacy" className="underline hover:text-primary-600 dark:hover:text-primary-400">
                Privacy details
              </Link>
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={DECISION_BUTTON_CLASSES} onClick={() => decide(true, true)}>
                Accept all
              </button>
              <button type="button" className={DECISION_BUTTON_CLASSES} onClick={() => decide(false, false)}>
                Reject optional
              </button>
              <button type="button" className={QUIET_BUTTON_CLASSES} onClick={openPreferences}>
                Manage preferences
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {preferencesOpen ? (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Privacy preferences"
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Privacy preferences</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Choose which optional measurement may run. Your choice is stored locally and you can change or withdraw it here at any time.
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Necessary</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Required for the site to work: your theme, sidebar, and this consent choice. Always on.
                  </p>
                </div>
                <input type="checkbox" checked disabled aria-label="Necessary storage, always enabled" className="mt-1 h-4 w-4" />
              </div>
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">Analytics</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Google Analytics: anonymous usage measurement to understand which pages and demos help.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={analyticsChoice}
                  onChange={(event) => setAnalyticsChoice(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
              </label>
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">Advertising</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Google Ads conversion measurement and advertising storage. Off unless you allow it.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={advertisingChoice}
                  onChange={(event) => setAdvertisingChoice(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={QUIET_BUTTON_CLASSES} onClick={closePreferences}>
                Cancel
              </button>
              <button type="button" className={DECISION_BUTTON_CLASSES} onClick={() => decide(false, false)}>
                Reject optional
              </button>
              <button type="button" className={DECISION_BUTTON_CLASSES} onClick={() => decide(analyticsChoice, advertisingChoice)}>
                Save preferences
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
