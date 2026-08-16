'use client'

import type { ReactNode, TouchEvent as ReactTouchEvent } from 'react'
import type { Timer } from '@hyperfrontend/time-utils'
import { TrackedLink } from '@/components/analytics/tracked-link'
import Link from 'next/link'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { abs, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { createTimer } from '@hyperfrontend/time-utils'

/** Bold-emphasized inline segment within a narrative line */
type BoldSegment = { bold: string }

/** Italic-emphasized inline segment within a narrative line */
type ItalicSegment = { italic: string }

type TextSegment = string | BoldSegment | ItalicSegment

interface Narrative {
  segments: TextSegment[]
}

const narratives: Narrative[] = [
  {
    segments: [
      'Coordination between engineering teams — different timezones, separate sprints, conflicting priorities — is ',
      { italic: 'painful' },
      ". Someone's always waiting on someone else. Hyperfrontend lets each team ",
      { bold: 'ship on their own schedule' },
      '. No more "we\'re blocked on Platform."',
    ],
  },
  {
    segments: [
      "You want to upgrade React. But Team Auth is still on 17. And nobody's touching that until Q3. Meanwhile, you're stuck with ",
      { italic: 'two-year-old dependencies' },
      '. Each hyperfrontend feature ',
      { bold: 'bundles its own stack' },
      '. Upgrade when it makes sense for your team.',
    ],
  },
  {
    segments: [
      'Sometimes the best move is to ',
      { italic: 'not touch working code' },
      '. Rewriting legacy apps burns enormous time reverse-engineering forgotten behavior. With hyperfrontend, ',
      { bold: 'convert that jQuery dinosaur into a feature' },
      ' and migrate on your own terms, when it actually matters.',
    ],
  },
  {
    segments: [
      'Everybody hand-rolls their own postMessage wrapper. None of them are compatible. Half of them ',
      { italic: 'silently fail' },
      '. Hyperfrontend gives you ',
      { bold: 'contract-validated messaging' },
      ' out of the box: type errors at build time, not production crashes.',
    ],
  },
  {
    segments: [
      'Passing auth tokens and PII over postMessage feels sketchy ',
      { italic: 'because it is' },
      ". Plaintext flying between windows. Hyperfrontend's optional encryption layer uses ",
      { bold: 'real AES-256-GCM' },
      '. Actual security, not security theater.',
    ],
  },
  {
    segments: [
      'Need to show a feature inline? In a modal? Pop it out to a new tab? Everyone ',
      { italic: 'reinvents the wheel' },
      '. Different code paths, different bugs. ',
      { bold: 'One lifecycle API handles all display modes.' },
      ' Write it once, mount it anywhere.',
    ],
  },
  {
    segments: [
      '"How long to integrate Partner X?" ',
      { italic: 'Six months, apparently.' },
      ' Custom API, custom events, custom everything. Hyperfrontend shells are ',
      { bold: 'self-contained' },
      ': partners drop in a script tag or npm install. Integration measured in days, not quarters.',
    ],
  },
  {
    segments: [
      'Half the team loves Vue. The other half swears by React. The architect demands Angular "for enterprise reasons." ',
      { italic: 'Stop fighting.' },
      " Hyperfrontend's ",
      { bold: "protocol layer doesn't care what framework you use" },
      '. Pick what makes your team productive.',
    ],
  },
  {
    segments: [
      'Your business ships payment widgets to thousands of merchant sites. Each host page is different: ',
      { italic: 'different frameworks, different CSPs, different everything' },
      ". You can't control what they run. Hyperfrontend features are ",
      { bold: 'fully self-contained sandboxes' },
      '. Your widget works reliably no matter how chaotic the host environment.',
    ],
  },
  {
    segments: [
      'You deploy a new feature version. Shell expects method A, feature now exports method B. ',
      { italic: 'Runtime crash. No warning.' },
      " Handrolled solutions don't catch this. Hyperfrontend's registry enforces ",
      { bold: 'semantic version matching' },
      ': incompatible deploys fail fast at resolution, not in production.',
    ],
  },
  {
    segments: [
      'User opens twelve tabs. Each tab has five embedded features. Real-time data streaming to all of them. ',
      { italic: 'Your message bus melts.' },
      ' Hyperfrontend handles ',
      { bold: '1:many connections with built-in backpressure' },
      '. Offload to web workers when the main thread gets busy.',
    ],
  },
  {
    segments: [
      'CSS from Feature A overrides Feature B. Global state leaks everywhere. Debugging becomes ',
      { italic: 'archaeology' },
      ". That's what poorly-implemented micro-frontends get you. Hyperfrontend enforces ",
      { bold: 'strict domain isolation' },
      ': no leaky abstractions, no accidental coupling.',
    ],
  },
  {
    segments: [
      'CDN hiccup. Feature fails to load. In tightly-coupled apps, ',
      { italic: 'the whole page crashes' },
      '. Users see a white screen. Hyperfrontend shells ',
      { bold: 'degrade gracefully' },
      ': one failed feature shows a fallback, everything else keeps working.',
    ],
  },
  {
    segments: [
      "Bug in production. Traditional apps: roll back the entire deploy, lose everyone's changes. ",
      { italic: 'Chaos ensues.' },
      ' With hyperfrontend, ',
      { bold: 'roll back a single feature' },
      " to its last stable version. The shell and other features don't even notice.",
    ],
  },
  {
    segments: [
      'Security review for every integration. ',
      { italic: 'Six weeks each.' },
      " Same checklist, same questions, same delays. Hyperfrontend's encryption implementation is ",
      { bold: 'one auditable codebase' },
      '. Pass the audit once, deploy everywhere.',
    ],
  },
  {
    segments: [
      'You acquired a company. Great product. Built in Ember. Your stack is React. ',
      { italic: '"Eighteen-month integration roadmap"' },
      ' makes everyone queasy. Hyperfrontend ',
      { bold: 'wraps their app as-is' },
      ": integrate in weeks, modernize when you're ready.",
    ],
  },
  {
    segments: [
      "The messaging library you found only works with Webpack. You're migrating to Vite. ",
      { italic: "Congratulations, it's broken." },
      ' Hyperfrontend ',
      { bold: 'ships every format' },
      ": ESM, CommonJS, IIFE, UMD. Works with whatever you're running.",
    ],
  },
]

function renderNarrative(narrative: Narrative): ReactNode {
  return narrative.segments.map((segment, i) => {
    if (typeof segment === 'string') {
      return <Fragment key={i}>{segment}</Fragment>
    }
    if ('bold' in segment) {
      return (
        <strong key={i} className="font-semibold text-slate-800 dark:text-slate-200">
          {segment.bold}
        </strong>
      )
    }
    if ('italic' in segment) {
      return (
        <em key={i} className="text-slate-500 dark:text-slate-500">
          {segment.italic}
        </em>
      )
    }
    return null
  })
}

const CYCLE_DURATION = 12000
const TRANSITION_DURATION = 300
/** context: Minimum px distance to register as a swipe gesture */
const SWIPE_THRESHOLD = 50

export function ValueProposition() {
  const [currentSet, setCurrentSet] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)

  const touchStartXRef = useRef<number | null>(null)
  const timerRef = useRef<Timer | null>(null)
  const progressStartTimeRef = useRef<number>(dateNow())
  const accumulatedProgressRef = useRef<number>(0)

  const advanceToNext = useCallback(() => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentSet((prev) => (prev + 1) % narratives.length)
      setIsTransitioning(false)
      setProgress(0)
      accumulatedProgressRef.current = 0
      progressStartTimeRef.current = dateNow()
      timerRef.current?.reset()
    }, TRANSITION_DURATION)
  }, [])

  const goToSlide = useCallback(
    (index: number) => {
      if (index === currentSet || isTransitioning) return
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentSet(index)
        setIsTransitioning(false)
        setProgress(0)
        accumulatedProgressRef.current = 0
        progressStartTimeRef.current = dateNow()
        timerRef.current?.reset()
      }, TRANSITION_DURATION)
    },
    [currentSet, isTransitioning]
  )

  const goToPrevious = useCallback(() => {
    const newIndex = currentSet === 0 ? narratives.length - 1 : currentSet - 1
    goToSlide(newIndex)
  }, [currentSet, goToSlide])

  const goToNext = useCallback(() => {
    const newIndex = (currentSet + 1) % narratives.length
    goToSlide(newIndex)
  }, [currentSet, goToSlide])

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    setIsPaused(true)
  }, [])

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (touchStartXRef.current === null) return
    const deltaX = e.touches[0].clientX - touchStartXRef.current
    // why: Prevent page scroll when user intends to swipe the carousel
    if (abs(deltaX) > 10) {
      e.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent) => {
      if (touchStartXRef.current === null) return
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current
      if (deltaX > SWIPE_THRESHOLD) {
        goToPrevious()
      } else if (deltaX < -SWIPE_THRESHOLD) {
        goToNext()
      }
      touchStartXRef.current = null
      setIsPaused(false)
    },
    [goToNext, goToPrevious]
  )

  // how: createTimer handles pause/resume internally while we manage the auto-advance
  useEffect(() => {
    const timer = createTimer(advanceToNext, CYCLE_DURATION)
    timerRef.current = timer
    timer.resume()

    return () => {
      timer.pause()
    }
  }, [advanceToNext])

  // how: Pause/resume the timer based on user interaction
  useEffect(() => {
    if (isPaused) {
      timerRef.current?.pause()
      accumulatedProgressRef.current += dateNow() - progressStartTimeRef.current
    } else {
      timerRef.current?.resume()
      progressStartTimeRef.current = dateNow()
    }
  }, [isPaused])

  // how: requestAnimationFrame for smooth progress bar visual updates
  useEffect(() => {
    let frameId: number | null = null

    const updateProgress = () => {
      if (isPaused || isTransitioning) {
        frameId = requestAnimationFrame(updateProgress)
        return
      }

      const elapsed = dateNow() - progressStartTimeRef.current
      const totalProgress = accumulatedProgressRef.current + elapsed
      const progressPercent = min((totalProgress / CYCLE_DURATION) * 100, 100)
      setProgress(progressPercent)

      frameId = requestAnimationFrame(updateProgress)
    }

    frameId = requestAnimationFrame(updateProgress)

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [isPaused, isTransitioning])

  const current = narratives[currentSet]

  return (
    <div className="flex h-full flex-col justify-center py-8 lg:py-12">
      {/* Headline */}
      <div className="mb-6 lg:mb-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-primary-600 dark:text-primary-400">
          Micro-Frontend Architecture
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
          Ship independently.
          <br />
          <span className="text-primary-600 dark:text-primary-400">Compose at runtime.</span>
        </h1>
      </div>

      {/* Rotating Value Narrative with carousel controls */}
      <div
        className="relative mb-6 lg:mb-8"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Left arrow - visible only on larger screens */}
        <button
          onClick={goToPrevious}
          className="absolute -left-10 top-1/2 hidden -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 lg:block"
          aria-label="Previous benefit"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        {/* Right arrow - visible only on larger screens */}
        <button
          onClick={goToNext}
          className="absolute -right-10 top-1/2 hidden -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 lg:block"
          aria-label="Next benefit"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>

        {/* Top divider line - 25% width, thinner, centered */}
        <div className="mx-auto mb-6 h-0.5 w-1/4 rounded-full bg-slate-200/60 dark:bg-slate-700/60" />

        {/* Narrative content with fixed height to prevent layout shift */}
        <div
          className={`flex h-[6.5rem] items-center transition-opacity duration-300 sm:h-[5rem] lg:h-[4.5rem] ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
        >
          <p className="line-clamp-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">{renderNarrative(current)}</p>
        </div>

        {/* Progress bar - 50% width, centered */}
        <div className="mx-auto mt-6 h-1 w-1/2 overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-700/60">
          <div className="h-full rounded-full bg-primary-500/15" style={{ width: `${progress}%` }} />
        </div>

        {/* Progress dots - 50% width container, centered */}
        <div className="mx-auto mt-3 flex w-1/2 justify-center gap-1.5">
          {narratives.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`h-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                i === currentSet ? 'w-4 bg-primary-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500'
              }`}
              aria-label={`View benefit ${i + 1}`}
              aria-current={i === currentSet ? 'true' : 'false'}
            />
          ))}
        </div>

        {/* Mobile swipe hint */}
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 lg:hidden">Swipe to navigate</p>
      </div>

      {/* Install Snippet */}
      <div className="mb-6 lg:mb-8">
        <InstallCommand />
      </div>

      {/* Navigation Links */}
      <div className="flex flex-wrap gap-3">
        <TrackedLink href="/docs" event={{ kind: 'docs-cta', cta: 'value-prop-get-started' }} className="btn-primary">
          Get Started
        </TrackedLink>
        <TrackedLink
          href="https://github.com/AndrewRedican/hyperfrontend"
          event={{ kind: 'repo', location: 'value-proposition' }}
          external
          className="btn-secondary"
        >
          <GitHubIcon className="mr-2 h-4 w-4" />
          GitHub
        </TrackedLink>
        <Link href="/demos" className="btn-ghost">
          Demos
        </Link>
        <Link href="/architecture" className="btn-ghost">
          Architecture
        </Link>
      </div>

      {/* Package Info */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-500 lg:mt-8">
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-3 w-3 text-green-500" />
          TypeScript
        </span>
        <a
          href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
        >
          <CheckIcon className="h-3 w-3 text-green-500" />
          MIT License
        </a>
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-3 w-3 text-green-500" />
          Zero runtime deps
        </span>
      </div>

      {/* GitHub Badges */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <TrackedLink
          href="https://github.com/AndrewRedican/hyperfrontend"
          event={{ kind: 'repo', location: 'value-proposition' }}
          external
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <StarIcon className="h-3.5 w-3.5 text-amber-500" />
          Star on GitHub
        </TrackedLink>
        <a
          href="https://github.com/sponsors/AndrewRedican"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-pink-200 bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700 transition-colors hover:bg-pink-100 dark:border-pink-900 dark:bg-pink-950/50 dark:text-pink-300 dark:hover:bg-pink-900/50"
        >
          <HeartIcon className="h-3.5 w-3.5" />
          Sponsor
        </a>
      </div>
    </div>
  )
}

function InstallCommand() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install @hyperfrontend/features')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative inline-block">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/50">
        <span className="text-slate-500 dark:text-slate-400">$</span>
        <code className="text-slate-700 dark:text-slate-300">npm install @hyperfrontend/features</code>
        <button
          onClick={handleCopy}
          className="ml-2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label="Copy to clipboard"
        >
          {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <CopyIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

/** Common props for value-proposition icons */
type IconProps = { className?: string }

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function GitHubIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function HeartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001l-.002-.001z" />
    </svg>
  )
}

function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}
