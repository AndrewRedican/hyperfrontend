import { GA_MEASUREMENT_ID } from '@/lib/analytics'
import { GOOGLE_CONSENT_DEFAULTS } from '@/lib/consent/google-consent'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { ConsentGatedTags } from './consent-gated-tags'
import { RouteTracker } from './route-tracker'

/**
 * Mounts the Google measurement layer under Consent Mode v2 in **basic**
 * form: the inline bootstrap only queues the denied-by-default consent state
 * — it loads nothing and contacts no one. The gtag.js library is added by
 * {@link ConsentGatedTags} only after the visitor grants an optional
 * category, so before consent there are no analytics or advertising
 * requests, not even cookieless pings. Renders nothing at all when
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` is unset at build time — that env var is
 * the production gate, so development, preview, and test builds ship zero
 * analytics.
 */
export function Analytics() {
  if (!GA_MEASUREMENT_ID) return null

  // why: consent must be denied before any later command so no hit can ever store an identifier
  const bootstrap = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', ${stringify(GOOGLE_CONSENT_DEFAULTS)});
gtag('js', new Date());`

  return (
    <>
      {/* why: a parser-executed inline script (not next/script) guarantees the consent default is queued before any hydration code can push a command */}
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      <ConsentGatedTags />
      <RouteTracker />
    </>
  )
}
