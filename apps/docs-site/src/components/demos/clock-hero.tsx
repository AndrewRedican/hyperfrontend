'use client'

import type { EmbedStatus } from './clock-embed'
import { DEMO_MANIFEST } from '@/lib/demo-manifest'
import { useState } from 'react'
import { ClockEmbed } from './clock-embed'

/**
 * The landing-page hero embed: the live clock coin, floating transparent over
 * the hero background, with a small provenance caption.
 *
 * The docs-site is itself a hyperfrontend host here — the coin arrives through
 * the vendored `@hyperfrontend/demo-clock-shell` connector, not an `<img>`.
 * While the feature origin is unreachable the embed degrades to the committed
 * poster and the caption says so, quietly.
 */
export function ClockHero() {
  const [status, setStatus] = useState<EmbedStatus>('connecting')
  const clock = DEMO_MANIFEST.find((entry) => entry.slug === 'clock')
  if (!clock?.featureUrl) {
    return null
  }
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ClockEmbed featureUrl={clock.featureUrl} poster={clock.poster} className="aspect-square w-full max-w-md" onStatus={setStatus} />
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        {status === 'live' ? (
          <>Live demo — {clock.stack}, embedded via its generated shell. </>
        ) : status === 'offline' ? (
          <>Preview — the live demo is warming up on its own origin. </>
        ) : (
          <>Connecting to the live demo on its own origin… </>
        )}
        <a href="/demos" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
          All demos →
        </a>
      </p>
    </div>
  )
}
