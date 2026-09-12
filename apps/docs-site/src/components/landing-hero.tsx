'use client'

import type { EcosystemDownloads } from '@/lib/downloads-route'
import { useDemoStage } from '@/components/demo-stage'
import { getDemoTheme } from '@/components/demos/demo-fallback-card'
import { DemoShowcase } from '@/components/demos/demo-showcase'
import { ScrollToExplore } from '@/components/scroll-to-explore'
import { TesseractBackground } from '@/components/tesseract-background'
import { ValueProposition } from '@/components/value-proposition'
import { DEMO_MANIFEST } from '@/lib/demo-manifest'

/** Props for {@link LandingHero}. */
export interface LandingHeroProps {
  /** The ecosystem's tracked npm downloads, or null before any have been collected */
  downloads: EcosystemDownloads | null
}

/**
 * The landing page's full-height hero: value proposition on the left, the
 * rotating demo showcase on the right, and the diving tesseract backdrop
 * behind both. Which demo holds the showcase stage lives on the shared stage
 * rather than here, because the lattice is no longer the only thing tinting
 * toward it: the band below the hero takes the same hue.
 * @param props - See {@link LandingHeroProps}.
 * @param props.downloads - The ecosystem's tracked npm downloads
 * @returns The hero section.
 */
export function LandingHero({ downloads }: LandingHeroProps) {
  const { activeDemo, setActiveDemo } = useDemoStage()
  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] bg-[length:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)]" />

      {/* Composability matrix — a 4D micro-frontend lattice diving through nested layers, tinted toward the staged demo's ambient hue */}
      <TesseractBackground dive accent={activeDemo ? getDemoTheme(activeDemo.slug).accent : undefined} />

      <div className="relative mx-auto flex h-full max-w-8xl flex-col lg:flex-row lg:items-stretch">
        {/* Left Side - Value Proposition */}
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-8 lg:w-1/2 lg:px-12 lg:py-8 xl:px-16">
          <ValueProposition downloads={downloads} />
        </div>

        {/* Right Side - Demo Showcase */}
        <div className="flex w-full items-center justify-center px-6 py-12 sm:px-8 lg:w-1/2 lg:px-12 lg:py-8">
          <DemoShowcase entries={DEMO_MANIFEST} cycleDuration={20000} onActive={setActiveDemo} />
        </div>
      </div>

      {/* Scroll Indicator - hidden on mobile where content is stacked */}
      <ScrollToExplore />
    </section>
  )
}
