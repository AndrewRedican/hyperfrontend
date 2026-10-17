import { DemoStageProvider } from '@/components/demo-stage'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { LandingDiscoverySection } from '@/components/landing-discovery-section'
import { LandingHero } from '@/components/landing-hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { PackagesSection } from '@/components/landing/packages-section'
import { StageAccent } from '@/components/landing/stage-accent'
import { LightWell } from '@/components/light-well'
import { getDownloadsSnapshot } from '@/lib/downloads'

export default function HomePage() {
  const downloads = getDownloadsSnapshot()

  return (
    <DemoStageProvider>
      {/* why: the staged demo's hue reaches the header as well as the water below the fold, so the stage wraps the whole page rather than the hero alone */}
      <StageAccent />
      <div className="flex min-h-screen flex-col">
        <Header staged />
        <main id="main-content" className="flex-1">
          {/* Hero Section - 50/50 Split Layout */}
          <LandingHero downloads={downloads === null ? null : { total: downloads.total, packages: downloads.packages.length }} />

          {/* Everything below the hero sits in water lit by the staged demo: the discovery arc, the architecture, and the packages */}
          <LightWell>
            <LandingDiscoverySection />
            <HowItWorks />
            <PackagesSection />
          </LightWell>
        </main>
        <Footer />
      </div>
    </DemoStageProvider>
  )
}
