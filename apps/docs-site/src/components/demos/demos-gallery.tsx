'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { ClockShell } from './clock-embed'
import { useState } from 'react'
import { ClockHostConsole } from './clock-host-console'
import { CoverFlow } from './cover-flow'

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
  const [shell, setShell] = useState<ClockShell | null>(null)
  const [centered, setCentered] = useState<DemoManifestEntry | undefined>(entries[0])
  return (
    <div className="relative flex w-full flex-col items-center">
      <CoverFlow entries={entries} onShell={setShell} onCentered={setCentered} />
      {centered ? <ClockHostConsole entry={centered} shell={shell} /> : null}
    </div>
  )
}
