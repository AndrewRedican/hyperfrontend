'use client'

import { Breadcrumb } from '@/components/breadcrumb'
import { H1, H2 } from '@/components/heading-with-anchor'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { floor, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Library data for display
 */
interface LibraryCardData {
  title: string
  description: string
  href: string
  keywords: string[]
  category: 'core' | 'supporting' | 'utils' | 'plugin'
}

/**
 * Static library data - matches what would come from manifest
 */
const LIBRARY_DATA: LibraryCardData[] = [
  {
    title: '@hyperfrontend/nexus',
    description: 'Cross-window communication library for micro-frontends with secure messaging, state management, and contract validation.',
    href: '/docs/libraries/nexus',
    keywords: ['postmessage', 'cross-window', 'iframe', 'micro-frontend', 'message-broker', 'contract-validation'],
    category: 'core',
  },
  {
    title: '@hyperfrontend/network-protocol',
    description: 'Secure message transport with encryption and queue-based processing',
    href: '/docs/libraries/network-protocol',
    keywords: ['network', 'protocol', 'encryption', 'queue', 'message-transport', 'security'],
    category: 'core',
  },
  {
    title: '@hyperfrontend/cryptography',
    description: 'AES-GCM encryption, PBKDF2 key derivation, and secure vaults',
    href: '/docs/libraries/cryptography',
    keywords: ['encryption', 'aes-gcm', 'pbkdf2', 'crypto', 'vault', 'security', 'hash'],
    category: 'core',
  },
  {
    title: '@hyperfrontend/project-scope',
    description: 'Project analysis and dependency detection for Nx workspaces',
    href: '/docs/libraries/project-scope',
    keywords: ['nx', 'project-analysis', 'dependency-detection', 'workspace', 'monorepo'],
    category: 'core',
  },
  {
    title: '@hyperfrontend/state-machine',
    description: 'Redux-inspired state management with async operation support',
    href: '/docs/libraries/state-machine',
    keywords: ['state-management', 'redux', 'async', 'reducer', 'store'],
    category: 'supporting',
  },
  {
    title: '@hyperfrontend/web-worker',
    description: 'Web Worker utilities and abstractions',
    href: '/docs/libraries/web-worker',
    keywords: ['web-worker', 'worker', 'threading', 'background', 'parallel'],
    category: 'supporting',
  },
  {
    title: '@hyperfrontend/logging',
    description: 'Runtime log level control with error-resilient execution',
    href: '/docs/libraries/logging',
    keywords: ['logging', 'console', 'debug', 'log-level', 'runtime'],
    category: 'supporting',
  },
  {
    title: '@hyperfrontend/versioning',
    description: 'Automated versioning, changelog generation, and release management',
    href: '/docs/libraries/versioning',
    keywords: ['versioning', 'semver', 'changelog', 'release', 'git', 'npm'],
    category: 'supporting',
  },
  {
    title: '@hyperfrontend/data-utils',
    description: 'Type detection and deep equality utilities for runtime value analysis',
    href: '/docs/libraries/utils/data',
    keywords: ['type-detection', 'deep-equal', 'runtime', 'type-checking', 'comparison'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/function-utils',
    description: 'Function composition, debounce, throttle, and control flow utilities',
    href: '/docs/libraries/utils/function',
    keywords: ['debounce', 'throttle', 'compose', 'pipe', 'memoize', 'function'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/immutable-api-utils',
    description: 'Immutable-safe wrappers for built-in JavaScript APIs',
    href: '/docs/libraries/utils/immutable-api',
    keywords: ['immutable', 'pure', 'functional', 'built-in', 'wrapper', 'safe'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/json-utils',
    description: 'Safe JSON parsing with type-preserving serialization',
    href: '/docs/libraries/utils/json',
    keywords: ['json', 'parse', 'stringify', 'safe', 'type-preserving'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/list-utils',
    description: 'Array manipulation utilities for filtering, sorting, and transformation',
    href: '/docs/libraries/utils/list',
    keywords: ['array', 'list', 'filter', 'sort', 'transform', 'collection'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/random-generator-utils',
    description: 'Cryptographically secure random value generation',
    href: '/docs/libraries/utils/random-generator',
    keywords: ['random', 'uuid', 'crypto', 'generator', 'secure'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/string-utils',
    description: 'Isomorphic string encoding utilities with unified APIs for browser and Node.js',
    href: '/docs/libraries/utils/string',
    keywords: ['base64', 'encoding', 'utf8', 'string', 'uint8array', 'isomorphic'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/time-utils',
    description: 'Date/time formatting and duration utilities',
    href: '/docs/libraries/utils/time',
    keywords: ['date', 'time', 'format', 'duration', 'timestamp'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/ui-utils',
    description: 'Modular DOM utilities for dynamic styling, gesture detection, and color manipulation',
    href: '/docs/libraries/utils/ui',
    keywords: ['dom', 'css', 'color', 'gesture', 'styling', 'element'],
    category: 'utils',
  },
  {
    title: '@hyperfrontend/features',
    description:
      'Vendor-agnostic SDK, CLI, and dev server for building, embedding, and orchestrating hyperfrontend micro-frontend features',
    href: '/docs/libraries/features',
    keywords: ['micro-frontend', 'microfrontend', 'iframe', 'sdk', 'host', 'hostee', 'vendor-agnostic'],
    category: 'core',
  },
]

/**
 * Color palette for flash effects - distinct colors that look good on both light/dark themes
 */
const FLASH_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#84cc16', '#6366f1', '#14b8a6']

/**
 * Get a random flash color that's different from adjacent cards
 * @param index - Card index
 * @param previousColor - Color of the previous card (if any)
 * @returns A hex color string
 */
function getFlashColor(index: number, previousColor?: string): string {
  const availableColors = previousColor ? FLASH_COLORS.filter((c) => c !== previousColor) : FLASH_COLORS
  const randomIndex = floor(random() * availableColors.length)
  return availableColors[randomIndex]
}

/**
 * Client-side libraries page content with interactive search.
 */
export function LibrariesPageContent() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLibraries = useMemo(() => {
    if (!searchQuery.trim()) return LIBRARY_DATA

    const query = searchQuery.toLowerCase()
    return LIBRARY_DATA.filter(
      (lib) =>
        lib.title.toLowerCase().includes(query) ||
        lib.description.toLowerCase().includes(query) ||
        lib.keywords.some((kw) => kw.toLowerCase().includes(query))
    )
  }, [searchQuery])

  const coreLibraries = useMemo(() => filteredLibraries.filter((lib) => lib.category === 'core'), [filteredLibraries])
  const supportingLibraries = useMemo(() => filteredLibraries.filter((lib) => lib.category === 'supporting'), [filteredLibraries])
  const utilsLibraries = useMemo(() => filteredLibraries.filter((lib) => lib.category === 'utils'), [filteredLibraries])
  const plugins = useMemo(() => filteredLibraries.filter((lib) => lib.category === 'plugin'), [filteredLibraries])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  return (
    <>
      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Package Index</H1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Complete API documentation for all HyperFrontend packages. Generated from TypeScript source.
      </p>

      {/* Search Bar */}
      <div className="mt-8 relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search packages by name, description, or keyword..."
          className="w-full pl-10 pr-10 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Clear search"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {filteredLibraries.length === 0 && (
        <div className="mt-8 text-center py-12 text-slate-500 dark:text-slate-400">
          No packages match your search. Try different keywords.
        </div>
      )}

      {/* Core Libraries */}
      {coreLibraries.length > 0 && (
        <section className="mt-12">
          <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Core Libraries</H2>
          <div className="mt-6 grid gap-4">
            {coreLibraries.map((lib, index) => (
              <ApiCard key={lib.title} {...lib} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* Supporting Libraries */}
      {supportingLibraries.length > 0 && (
        <section className="mt-12">
          <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Supporting Libraries</H2>
          <div className="mt-6 grid gap-4">
            {supportingLibraries.map((lib, index) => (
              <ApiCard key={lib.title} {...lib} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* Utility Libraries */}
      {utilsLibraries.length > 0 && (
        <section className="mt-12">
          <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Utility Libraries</H2>
          <div className="mt-6 grid gap-4">
            {utilsLibraries.map((lib, index) => (
              <ApiCard key={lib.title} {...lib} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* Nx Plugin */}
      {plugins.length > 0 && (
        <section className="mt-12">
          <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Nx Plugin</H2>
          <div className="mt-6 grid gap-4">
            {plugins.map((lib, index) => (
              <ApiCard key={lib.title} {...lib} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* TypeDoc Notice */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generated Documentation</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Full API documentation is generated from TypeScript JSDoc comments using{' '}
          <a
            href="https://typedoc.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline dark:text-primary-400"
          >
            TypeDoc
          </a>
          . Each package includes inline documentation accessible via your IDE&apos;s IntelliSense.
        </p>
        <div className="mt-4">
          <Link
            href="https://github.com/AndrewRedican/hyperfrontend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            View source on GitHub
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}

/** Props for {@link ApiCard}: a library card extended with its position in the grid */
interface ApiCardProps extends LibraryCardData {
  index: number
}

/**
 * API Card component with flash animation
 * @param root0
 * @param root0.title
 * @param root0.description
 * @param root0.href
 * @param root0.keywords
 * @param root0.index
 */
function ApiCard({ title, description, href, keywords, index }: ApiCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const [flashDirection, setFlashDirection] = useState<'left' | 'right'>('left')

  useEffect(() => {
    const scheduleFlash = () => {
      const delay = 6000 + random() * 4000

      const timeoutId = setTimeout(() => {
        const color = getFlashColor(index)
        setFlashColor(color)
        setFlashDirection(random() > 0.5 ? 'left' : 'right')

        setTimeout(() => {
          setFlashColor(null)
        }, 600)

        scheduleFlash()
      }, delay)

      return timeoutId
    }

    const timeoutId = scheduleFlash()
    return () => clearTimeout(timeoutId)
  }, [index])

  return (
    <Link
      ref={cardRef}
      href={href}
      className="group relative block overflow-hidden rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-primary-300 hover:bg-primary-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
    >
      {/* Flash overlay */}
      {flashColor && (
        <div
          className={`absolute inset-0 pointer-events-none ${flashDirection === 'left' ? 'animate-flash-left' : 'animate-flash-right'}`}
          style={{
            background: `linear-gradient(${flashDirection === 'left' ? '90deg' : '-90deg'}, transparent 0%, ${flashColor}33 50%, transparent 100%)`,
          }}
        />
      )}

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-mono text-sm font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        <ArrowRightIcon className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary-500" />
      </div>

      {/* Keywords as tags */}
      {keywords.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {keywords.slice(0, 6).map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              {keyword}
            </span>
          ))}
          {keywords.length > 6 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-500">
              +{keywords.length - 6}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

type IconProps = { className?: string }

function SearchIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  )
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
