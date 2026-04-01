'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { min, pow } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { requestAnimationFrame, cancelAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

interface DemoShowcaseProps {
  /** Duration in milliseconds for full cycle (default: 60000ms = 1 minute) */
  cycleDuration?: number
  /** Duration in milliseconds for fast-forward animation (default: 2000ms) */
  fastForwardDuration?: number
  /** Callback when demo index changes */
  onDemoChange?: (index: number) => void
  /** Number of demos available */
  demoCount?: number
  /** Current demo index (controlled mode) */
  currentDemo?: number
  children?: React.ReactNode
}

export function DemoShowcase({
  cycleDuration = 60000,
  fastForwardDuration = 2000,
  onDemoChange,
  demoCount = 6,
  currentDemo: controlledDemo,
  children,
}: DemoShowcaseProps) {
  const [progress, setProgress] = useState(0)
  const [internalDemo, setInternalDemo] = useState(0)
  const [isFastForwarding, setIsFastForwarding] = useState(false)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const fastForwardStartRef = useRef<{ time: number; progress: number } | null>(null)

  const currentDemoIndex = controlledDemo ?? internalDemo

  const advanceDemo = useCallback(() => {
    const nextIndex = (currentDemoIndex + 1) % demoCount
    if (controlledDemo === undefined) {
      setInternalDemo(nextIndex)
    }
    onDemoChange?.(nextIndex)
  }, [currentDemoIndex, demoCount, controlledDemo, onDemoChange])

  const handleFastForward = useCallback(() => {
    if (isFastForwarding) return
    setIsFastForwarding(true)
    fastForwardStartRef.current = { time: performance.now(), progress }
  }, [isFastForwarding, progress])

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp
      }

      if (isFastForwarding && fastForwardStartRef.current) {
        const elapsed = timestamp - fastForwardStartRef.current.time
        const startProgress = fastForwardStartRef.current.progress
        const remainingProgress = 100 - startProgress

        const t = min(elapsed / fastForwardDuration, 1)
        const easeOut = 1 - pow(1 - t, 3)
        const newProgress = startProgress + remainingProgress * easeOut

        if (newProgress >= 100) {
          setProgress(0)
          setIsFastForwarding(false)
          fastForwardStartRef.current = null
          startTimeRef.current = timestamp
          advanceDemo()
        } else {
          setProgress(newProgress)
        }
      } else {
        const elapsed = timestamp - startTimeRef.current
        const newProgress = (elapsed / cycleDuration) * 100

        if (newProgress >= 100) {
          setProgress(0)
          startTimeRef.current = timestamp
          advanceDemo()
        } else {
          setProgress(newProgress)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [cycleDuration, fastForwardDuration, isFastForwarding, advanceDemo])

  return (
    <div className="relative flex h-full w-full items-center justify-center p-4 lg:p-8">
      <div className="relative w-full max-w-2xl">
        {/* Base border with 50% opacity */}
        <div className="absolute inset-0 z-0 rounded-2xl border border-white/30 dark:border-white/20" />

        {/* Content container */}
        <div className="relative z-10 min-h-[400px] rounded-2xl bg-slate-900/5 p-6 backdrop-blur-sm dark:bg-white/5 lg:min-h-[500px] lg:p-8">
          {children || <DemoPlaceholder index={currentDemoIndex} />}
        </div>

        {/* Animated progress border - on top, mask ensures only border edge is visible */}
        <ProgressBorder progress={progress} />

        {/* Fast-forward button */}
        <button
          onClick={handleFastForward}
          disabled={isFastForwarding}
          className="absolute -bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/10 p-2 text-slate-500 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-slate-700 disabled:opacity-50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
          aria-label="Skip to next demo"
        >
          <SkipIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function ProgressBorder({ progress }: { progress: number }) {
  if (progress <= 0) return null

  const angle = (progress / 100) * 360

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 rounded-2xl"
      style={{
        background: `conic-gradient(from -90deg, #6366f1 ${angle}deg, transparent ${angle}deg)`,
        WebkitMask: `
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0)
        `,
        WebkitMaskComposite: 'xor',
        mask: `
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0)
        `,
        maskComposite: 'exclude',
        padding: '2px',
      }}
    />
  )
}

function DemoPlaceholder({ index }: { index: number }) {
  const demos = [
    { name: 'Chess', description: 'Multiplayer chess with real-time sync' },
    { name: 'Clock', description: 'Synchronized time across contexts' },
    { name: 'Events', description: 'Cross-window event propagation' },
    { name: 'File Share', description: 'Secure file transfer protocol' },
    { name: 'Heartbeat', description: 'Connection health monitoring' },
    { name: 'Views', description: 'Dynamic view composition' },
  ]

  const demo = demos[index] || demos[0]

  return (
    <div className="flex h-full min-h-[350px] flex-col items-center justify-center text-center lg:min-h-[450px]">
      <div className="mb-4 rounded-full bg-primary-500/10 p-4">
        <DemoIcon className="h-12 w-12 text-primary-500" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white lg:text-2xl">{demo.name}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 lg:text-base">{demo.description}</p>
      <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">Live demo placeholder — embed your micro-frontend here</p>
    </div>
  )
}

function SkipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v6.62c0 1.44 1.555 2.343 2.805 1.628L12 13.471v3.839c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.061C13.555 6.347 12 7.25 12 8.69v3.839L5.055 7.06z" />
    </svg>
  )
}

function DemoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  )
}
