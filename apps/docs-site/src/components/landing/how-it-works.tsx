'use client'

import type { ReactNode } from 'react'
import type { ArchitecturePart } from './architecture-figure'
import Link from 'next/link'
import { useState } from 'react'
import { ArchitectureFigure } from './architecture-figure'
import { ArrowGlyph } from './discovery-icons'

/** One of the three parts the figure draws, as the legend names and explains it. */
interface ArchitectureSurface {
  /** Which part of the drawing it is */
  id: ArchitecturePart
  /** Its name */
  title: string
  /** What it does, in a sentence or two */
  description: string
  /** Where the architecture guide explains it */
  href: string
  /** Its glyph */
  icon: ReactNode
}

/** The legend, in the order a message travels: from the host, through the broker, to the shell. */
const SURFACES: readonly ArchitectureSurface[] = [
  {
    id: 'host',
    title: 'Host application',
    description: 'Your main app loads features dynamically and manages their lifecycle. No build-time dependencies.',
    href: '/architecture#runtime-flow',
    icon: <HostIcon />,
  },
  {
    id: 'broker',
    title: 'Message broker',
    description: 'Routes typed messages between contexts with validation. Supports encryption for sensitive data.',
    href: '/architecture#broker-channel-model',
    icon: <BrokerIcon />,
  },
  {
    id: 'shell',
    title: 'Feature shell',
    description: 'A lightweight loader that bootstraps your micro-frontend and establishes the communication channel.',
    href: '/architecture#the-shell-pattern',
    icon: <ShellIcon />,
  },
]

/**
 * How it works, as one drawing and the three surfaces it is made of. The
 * drawing shows the organisation; the legend beside it says what each part is
 * for and links to the guide; pointing at either lifts the same part in both.
 * @returns The rendered section.
 */
export function HowItWorks() {
  const [highlight, setHighlight] = useState<ArchitecturePart | null>(null)

  return (
    <section id="how-it-works" className="border-t border-slate-200/70 py-16 dark:border-slate-800/70 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">How it works</h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-400">
            Each feature operates in its own iframe with standardized communication via the{' '}
            <Link
              href="/docs/libraries/nexus/"
              className="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-primary-700 underline decoration-primary-300 underline-offset-2 transition-colors hover:bg-primary-50 hover:decoration-primary-500 dark:bg-slate-800 dark:text-primary-300 dark:decoration-primary-700 dark:hover:bg-slate-700"
            >
              @hyperfrontend/nexus
            </Link>{' '}
            library. Messages are routed through a broker-channel architecture with optional encryption.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-7">
            <ArchitectureFigure highlight={highlight} onHighlight={setHighlight} />
          </div>
          <ul className="flex flex-col gap-4 lg:col-span-5">
            {SURFACES.map((surface) => (
              <li key={surface.id}>
                <a
                  href={surface.href}
                  data-koi-lit
                  onMouseEnter={() => setHighlight(surface.id)}
                  onMouseLeave={() => setHighlight(null)}
                  onFocus={() => setHighlight(surface.id)}
                  onBlur={() => setHighlight(null)}
                  className={`group block rounded-xl border bg-white/70 p-5 backdrop-blur-xs transition-colors lit:border-primary-300 lit:bg-primary-50/80 dark:bg-slate-800/45 dark:lit:border-primary-600 dark:lit:bg-slate-800/80 ${
                    highlight === surface.id ? 'border-primary-300 dark:border-primary-600' : 'border-slate-200/80 dark:border-slate-700/70'
                  }`}
                >
                  <span className="flex items-center justify-between gap-5">
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">{surface.title}</span>
                    <span className="inline-flex shrink-0 rounded-lg bg-primary-50 p-2.5 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                      {surface.icon}
                    </span>
                  </span>
                  <span className="mt-2 block text-sm text-slate-600 dark:text-slate-400">{surface.description}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 text-center">
          <a
            href="/architecture"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Read the Architecture Guide
            <ArrowGlyph className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

function HostIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
      />
    </svg>
  )
}

function ShellIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

function BrokerIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}
