'use client'

import type { LinkSuggestion } from '@/lib/link-suggestions'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { TesseractBackground } from '@/components/tesseract-background'
import { suggestRelatedLinks, generateBugReportUrl } from '@/lib/link-suggestions'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

/**
 * Fun 404 puns - slightly apologetic but humorous.
 */
const PUNS = [
  { headline: 'Oops! Link Went AWOL', subtext: "This page took an unscheduled coffee break. We've sent a search party." },
  { headline: '404: Page Playing Hide & Seek', subtext: "Spoiler alert: it's winning. Let us help you find what you need." },
  { headline: 'This Link Took a Wrong Turn', subtext: 'GPS says "rerouting"... Let\'s get you back on track.' },
  { headline: 'Page Not Found (But You Are!)', subtext: "The page is lost, but you're in the right place. Try these instead:" },
  { headline: 'Houston, We Have a Problem', subtext: "The requested URL has left the building. Here's mission control to assist." },
  { headline: 'Well, This is Awkward...', subtext: "We looked everywhere – even behind the couch. Here's what we found instead:" },
  { headline: '404: Link Evaporated', subtext: "Poof! It's gone. But don't worry, we have backup plans." },
  { headline: 'The Link Has Left the Chat', subtext: 'Disconnected without saying goodbye. Typical. Try these alternatives:' },
]

/**
 * Selects a random pun based on a seed derived from the path.
 * @param path
 */
function selectPun(path: string) {
  const hash = path.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return PUNS[hash % PUNS.length]
}

/**
 * Custom 404 page with helpful suggestions and bug reporting.
 */
export default function NotFound() {
  const pathname = usePathname()

  const { pun, suggestions, bugReportUrl } = useMemo(() => {
    const selectedPun = selectPun(pathname)
    const linkSuggestions = suggestRelatedLinks(pathname, 3)
    const reportUrl = generateBugReportUrl(pathname)

    return {
      pun: selectedPun,
      suggestions: linkSuggestions,
      bugReportUrl: reportUrl,
    }
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-900">
      <Header />
      <main id="main-content" className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        {/* Lost in hyperspace — the composability matrix dives behind the 404 */}
        <TesseractBackground dive intensity="subtle" />
        <div className="relative w-full max-w-lg text-center">
          {/* Animated 404 Display */}
          <div className="relative mb-8">
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <GlitchNumber digit="4" delay={0} />
              <FloatingZero />
              <GlitchNumber digit="4" delay={0.5} />
            </div>
            {/* Decorative particles */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <Particle className="left-[10%] top-[20%]" size="sm" delay={0} />
              <Particle className="right-[15%] top-[30%]" size="md" delay={0.3} />
              <Particle className="left-[20%] bottom-[25%]" size="sm" delay={0.6} />
              <Particle className="right-[10%] bottom-[20%]" size="lg" delay={0.9} />
            </div>
          </div>

          {/* Pun Headline */}
          <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{pun.headline}</h1>
          <p className="mb-8 text-base text-slate-600 dark:text-slate-400 sm:text-lg">{pun.subtext}</p>

          {/* Suggested Links */}
          <div className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Maybe you were looking for
            </h2>
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.href} suggestion={suggestion} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/" className="btn-primary">
              <HomeIcon className="mr-2 h-4 w-4" />
              Go Home
            </Link>
            <a href={bugReportUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <BugIcon className="mr-2 h-4 w-4" />
              Report Broken Link
            </a>
          </div>

          {/* Path display for context */}
          <div className="mt-8">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Requested path: <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{pathname}</code>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

/** Props for {@link GlitchNumber} */
type GlitchNumberProps = { digit: string; delay: number }

/**
 * A glitchy animated number for the 404 display.
 * @param root0
 * @param root0.digit
 * @param root0.delay
 */
function GlitchNumber({ digit, delay }: GlitchNumberProps) {
  return (
    <span
      className="relative inline-block font-display text-7xl font-black text-primary-600 dark:text-primary-400 sm:text-8xl md:text-9xl animate-pulse"
      style={{ animationDelay: `${delay}s`, animationDuration: '2s' }}
    >
      <span
        className="absolute inset-0 text-red-500/30 dark:text-red-400/30"
        style={{
          animation: 'glitch-skew 2s infinite linear alternate-reverse',
          animationDelay: `${delay + 0.1}s`,
          clipPath: 'polygon(0 0, 100% 0, 100% 35%, 0 35%)',
          transform: 'translateX(-2px)',
        }}
        aria-hidden="true"
      >
        {digit}
      </span>
      <span
        className="absolute inset-0 text-cyan-500/30 dark:text-cyan-400/30"
        style={{
          animation: 'glitch-skew 2s infinite linear alternate-reverse',
          animationDelay: `${delay + 0.2}s`,
          clipPath: 'polygon(0 65%, 100% 65%, 100% 100%, 0 100%)',
          transform: 'translateX(2px)',
        }}
        aria-hidden="true"
      >
        {digit}
      </span>
      {digit}
    </span>
  )
}

/**
 * A floating, rotating zero with orbit animation.
 */
function FloatingZero() {
  return (
    <span className="relative inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>
      <span className="font-display text-7xl font-black text-slate-300 dark:text-slate-600 sm:text-8xl md:text-9xl">0</span>
      {/* Orbit ring */}
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ animation: 'spin 8s linear infinite' }}
        aria-hidden="true"
      >
        <span className="absolute h-2 w-2 rounded-full bg-primary-500" style={{ transform: 'translateX(45px)' }} />
      </span>
    </span>
  )
}

/** Props for {@link Particle} */
type ParticleProps = { className: string; size: 'sm' | 'md' | 'lg'; delay: number }

/**
 * Floating decorative particle.
 * @param root0
 * @param root0.className
 * @param root0.size
 * @param root0.delay
 */
function Particle({ className, size, delay }: ParticleProps) {
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  }

  return (
    <span
      className={`absolute rounded-full bg-primary-400/40 dark:bg-primary-500/30 ${sizeClasses[size]} ${className}`}
      style={{
        animation: 'drift 4s ease-in-out infinite',
        animationDelay: `${delay}s`,
      }}
      aria-hidden="true"
    />
  )
}

/** Props for {@link SuggestionCard} */
type SuggestionCardProps = { suggestion: LinkSuggestion }

/**
 * A card displaying a link suggestion.
 * @param root0
 * @param root0.suggestion
 */
function SuggestionCard({ suggestion }: SuggestionCardProps) {
  return (
    <Link
      href={suggestion.href}
      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition-all hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-primary-700 dark:hover:bg-primary-900/20"
    >
      <div className="text-left">
        <h3 className="font-medium text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {suggestion.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{suggestion.description}</p>
      </div>
      <ArrowRightIcon className="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary-500 dark:text-slate-500" />
    </Link>
  )
}

/** Common props for not-found icons */
type IconProps = { className?: string }

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  )
}

function BugIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
