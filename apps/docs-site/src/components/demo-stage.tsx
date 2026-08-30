'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import { DEMO_MANIFEST } from '@/lib/demo-manifest'
import { createContext, useContext, useMemo, useState } from 'react'
import { noop } from '@hyperfrontend/function-utils'

/** Which demo currently holds the landing page's showcase stage. */
interface DemoStageValue {
  /** The staged demo, `null` only when the manifest is empty */
  activeDemo: DemoManifestEntry | null
  /** Hand the stage to a demo; the showcase calls this as its rotation advances */
  setActiveDemo: (entry: DemoManifestEntry) => void
}

/** Props for {@link DemoStageProvider} */
interface DemoStageProviderProps {
  /** The hero and everything below it that takes its colour from the staged demo */
  children: React.ReactNode
}

const DemoStageContext = createContext<DemoStageValue>({ activeDemo: null, setActiveDemo: noop })

/**
 * Read which demo is on the landing stage.
 * @returns The staged demo and the setter the showcase advances it with; outside a provider, an empty stage
 */
export function useDemoStage(): DemoStageValue {
  return useContext(DemoStageContext)
}

/**
 * Holds the staged demo for the whole top of the landing page.
 *
 * The showcase's rotation used to be the hero's private business, because the
 * tesseract was the only thing tinting toward it. It is shared state now: the
 * band below the hero lights up in the same hue, so the demo on stage colours
 * the page down past the fold rather than stopping at the hero's edge.
 * @param props - Component props
 * @param props.children - The hero and everything below it that takes its colour from the staged demo
 * @returns The provider wrapping its children
 */
export function DemoStageProvider({ children }: DemoStageProviderProps) {
  const [activeDemo, setActiveDemo] = useState<DemoManifestEntry | null>(DEMO_MANIFEST[0] ?? null)
  const value = useMemo(() => ({ activeDemo, setActiveDemo }), [activeDemo])

  return <DemoStageContext.Provider value={value}>{children}</DemoStageContext.Provider>
}
