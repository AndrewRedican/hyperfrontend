import { GA_MEASUREMENT_ID, GOOGLE_ADS_ID } from '@/lib/analytics'
import Script from 'next/script'
import { RouteTracker } from './route-tracker'

/**
 * Mounts Google Analytics (GA4, Google Ads-ready) in permanently cookieless
 * mode: Consent Mode v2 signals stay denied, so Google stores no cookies or
 * identifiers and measurement runs on anonymous pings — which is why the site
 * needs no consent banner. Renders nothing when
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` is unset at build time — that env var is the
 * production gate, so development and preview builds ship zero analytics.
 */
export function Analytics() {
  if (!GA_MEASUREMENT_ID) return null

  // why: consent must be denied before any config command so no hit can ever store an identifier
  const bootstrap = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}`

  return (
    <>
      {/* why: a parser-executed inline script (not next/script) guarantees the consent default and config are queued before hydration code can send the first page_view */}
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <RouteTracker />
    </>
  )
}
