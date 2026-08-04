'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { DemoShell } from './demo-wiring'
import { useEffect, useState } from 'react'
import { CoverFlow } from './cover-flow'
import { DemoHostConsole } from './demo-host-console'

/** Props for {@link DemosGallery}. */
export interface DemosGalleryProps {
  /** The demo manifest entries to page through, in order. */
  entries: readonly DemoManifestEntry[]
}

/**
 * The demos-page gallery: the cover-flow deck plus the host console floating
 * over its top-right corner, attached to whichever demo is centered.
 *
 * The deck hands up both the centered entry and — when the centered demo is
 * live — its embed's shell handle; the console follows that focus, driving the
 * live session or idling for a demo still in planning. De-centering a live
 * demo unmounts its embed and destroys its session, so nothing keeps running
 * off-screen.
 * @param root0
 * @param root0.entries
 */
export function DemosGallery({ entries }: DemosGalleryProps) {
  const [shell, setShell] = useState<DemoShell | null>(null)
  const [centered, setCentered] = useState<DemoManifestEntry | undefined>(entries[0])
  const [portrait, setPortrait] = useState(false)

  // why: One console per orientation, never both — the roomy landscape layout gets the inline panel, portrait gets the cog widget.
  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)')
    const apply = () => setPortrait(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  return (
    <div className="relative flex w-full flex-col items-center">
      <CoverFlow entries={entries} onShell={setShell} onCentered={setCentered} />
      {centered ? <DemoHostConsole entry={centered} shell={shell} floating={portrait} /> : null}
    </div>
  )
}
