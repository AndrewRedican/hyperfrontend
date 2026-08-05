import type { Metadata } from 'next'
import { ConsentSettingsButton } from '@/components/consent/consent-settings-button'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { GA_MEASUREMENT_ID, GOOGLE_ADS_ID } from '@/lib/analytics'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What this site stores, which measurement runs, the consent categories that control it, and how to change your choices.',
}

/** Styling for the privacy page's section headings. */
const SECTION_HEADING = 'mt-10 font-display text-xl font-semibold text-slate-900 dark:text-white'
/** Styling for the privacy page's body copy. */
const BODY = 'mt-3 text-slate-600 dark:text-slate-300'

export default function PrivacyPage() {
  const analyticsConfigured = Boolean(GA_MEASUREMENT_ID)
  const adsConfigured = Boolean(GOOGLE_ADS_ID)
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">Privacy</h1>
        <p className={BODY}>
          This page describes exactly what this site stores in your browser and what, if anything, it measures. It is written against the
          implementation, not as boilerplate — when the implementation changes, this page changes with it.
        </p>

        <h2 className={SECTION_HEADING}>Storage this site always uses</h2>
        <p className={BODY}>
          The site sets no cookies. It uses three <code>localStorage</code> entries, all in the <strong>necessary</strong> category, because
          they only remember choices you made on this device: <code>theme</code> (your light/dark preference),{' '}
          <code>docs-sidebar-collapsed</code> (your sidebar preference), and <code>hf-consent</code> (your privacy choice itself, including
          when you made it). They stay until you change them, withdraw them, or clear your browser storage, and they are never transmitted
          anywhere.
        </p>

        <h2 className={SECTION_HEADING}>Optional measurement and consent</h2>
        {analyticsConfigured ? (
          <p className={BODY}>
            This deployment has Google Analytics 4 configured. It runs under Google Consent Mode v2 in <em>basic</em> mode with two separate
            optional categories: <strong>analytics</strong> (controls Google Analytics measurement — page views and a small set of product
            events such as opening a demo or following a documentation link) and <strong>advertising</strong> (controls Google Ads
            conversion measurement, advertising storage, advertising user data, and ad personalization
            {adsConfigured ? '' : ' — no Google Ads account is currently configured, so nothing in this category is active even if granted'}
            ). Both categories default to denied for every visitor, worldwide — the site deliberately applies the conservative default
            globally instead of guessing your legal region. Until you grant a category, the Google tag library is not even loaded: no
            analytics or advertising request leaves the page, cookieless or otherwise. If you grant analytics, Google Analytics may set its
            own identifiers and receives page paths, event names with their fixed parameters (demo slugs, package names, link locations —
            never anything you type), and standard request metadata. You can change or withdraw your choice at any time from the Privacy
            settings control in the footer; withdrawal stops all future optional collection immediately.
          </p>
        ) : (
          <p className={BODY}>
            In this deployment <strong>no analytics or advertising is active at all</strong>. The measurement integration exists in the code
            but is dormant: without a configured measurement ID it renders nothing, loads no Google script, sends no request, and sets no
            identifier — which is also why you see no consent banner. If a future deployment activates Google Analytics or Google Ads, the
            consent experience switches on automatically with both optional categories denied by default, and this page will describe the
            active configuration.
          </p>
        )}

        <h2 className={SECTION_HEADING}>Embedded demos</h2>
        <p className={BODY}>
          The live demos on this site are independent applications embedded through the HyperFrontend protocol. The demo applications
          themselves load no analytics of any kind. Only this site (the host) reports measurement, so a demo session is never counted twice
          — whether it runs embedded in the gallery, in a dialog, in a popup, or not at all.
        </p>

        <h2 className={SECTION_HEADING}>Your controls</h2>
        <p className={BODY}>
          {analyticsConfigured
            ? 'Use the button below (also in the footer of every page) to review, change, or withdraw your consent choice:'
            : 'There is nothing to opt out of right now. If optional measurement is ever activated, a consent banner will ask first, and a persistent Privacy settings control will appear in the footer of every page.'}
        </p>
        {analyticsConfigured ? (
          <div className="mt-4">
            <ConsentSettingsButton className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:text-primary-400" />
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  )
}
