'use client'

import type { NavItem as SharedNavItem } from '../lib/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { docsNavigation, mainNavLinks as sharedMainNavLinks } from '../lib/navigation'
import { ThemeToggle } from './theme-toggle'

interface NavItem {
  title: string
  href?: string
  children?: NavItem[]
}

/**
 * Converts shared navigation items to mobile menu-specific format.
 * Uses the slug as the display title (without `@hyperfrontend/` prefix).
 * @param items - The shared navigation items to convert
 * @returns The converted navigation items for mobile menu
 */
function convertToMobileNav(items: SharedNavItem[]): NavItem[] {
  return items.map((item) => ({
    title: item.slug,
    href: item.href,
    children: item.children ? convertToMobileNav(item.children) : undefined,
  }))
}

const navigation = convertToMobileNav(docsNavigation)

const mainNavLinks = sharedMainNavLinks.map((item) => ({
  title: item.slug,
  href: item.href ?? '',
}))

/** Context for managing expanded sections in mobile menu */
interface MobileNavContextValue {
  expandedSections: Set<string>
  toggleSection: (path: string) => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

function useMobileNavContext() {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw createError('MobileNavSection must be used within MobileMenu')
  return ctx
}

/**
 * Match descriptor used while resolving the active mobile nav path: the
 * matched item path, the href length (for tie-breaking), and whether the path
 * was an exact hit.
 */
type MobileNavMatch = {
  itemPath: string[]
  hrefLength: number
  exact: boolean
}

/**
 * Finds all potential matches for the current pathname.
 * @param items
 * @param pathname
 * @param currentPath
 */
function findAllMatches(items: NavItem[], pathname: string, currentPath: string[] = []): Array<MobileNavMatch> {
  const normalizedPathname = normalizePath(pathname)
  const matches: Array<MobileNavMatch> = []

  for (const item of items) {
    const itemPath = [...currentPath, item.title]
    const normalizedHref = item.href ? normalizePath(item.href) : ''

    // how: check exact match
    if (normalizedHref === normalizedPathname) {
      matches.push({ itemPath, hrefLength: normalizedHref.length, exact: true })
    }
    // how: check prefix match
    else if (normalizedHref && normalizedPathname.startsWith(normalizedHref + '/')) {
      matches.push({ itemPath, hrefLength: normalizedHref.length, exact: false })
    }

    // how: always search children too
    if (item.children) {
      matches.push(...findAllMatches(item.children, pathname, itemPath))
    }
  }

  return matches
}

/**
 * Returns all paths that should be expanded to show the active item.
 * Finds the most specific (longest href) match across all items.
 * @param items
 * @param pathname
 */
function getExpandedPaths(items: NavItem[], pathname: string): Set<string> {
  const matches = findAllMatches(items, pathname)

  if (matches.length === 0) return createSet<string>()

  // how: prioritize exact matches, then longest href (most specific prefix)
  matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1
    return b.hrefLength - a.hrefLength
  })

  const bestMatch = matches[0]
  const paths = createSet<string>()

  // how: add all parent paths leading to the match
  for (let i = 1; i <= bestMatch.itemPath.length; i++) {
    paths.add(bestMatch.itemPath.slice(0, i).join('/'))
  }

  return paths
}

/**
 * Normalizes a pathname by removing trailing slashes for comparison.
 * @param path - The path to normalize
 */
function normalizePath(path: string): string {
  return path.replace(/\/$/, '')
}

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  const initialExpanded = useMemo(() => getExpandedPaths(navigation, pathname), [pathname])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(initialExpanded)

  useEffect(() => {
    const newExpanded = getExpandedPaths(navigation, pathname)
    setExpandedSections((prev) => {
      const merged = createSet(prev)
      newExpanded.forEach((p) => merged.add(p))
      return merged
    })
  }, [pathname])

  const toggleSection = useMemo(
    () => (pathKey: string) => {
      setExpandedSections((prev) => {
        const segments = pathKey.split('/')
        // context: parentPath is "" for top-level items, "Libraries" for "Libraries/versioning"
        const parentPath = segments.slice(0, -1).join('/')

        if (prev.has(pathKey)) {
          // how: collapsing removes this path and all its descendants
          const next = createSet<string>()
          prev.forEach((p) => {
            if (p !== pathKey && !p.startsWith(pathKey + '/')) {
              next.add(p)
            }
          })
          return next
        }

        /**
         * how: Accordion behavior when expanding:
         * - Keep ancestors of the new path
         * - Remove siblings (same parent, different name) and their descendants
         * - Keep paths from unrelated branches
         */
        const next = createSet<string>()

        prev.forEach((p) => {
          // how: keep ancestors (new path starts with this path)
          if (pathKey.startsWith(p + '/')) {
            next.add(p)
            return
          }

          // how: collapse siblings and their descendants
          if (parentPath !== '' && p.startsWith(parentPath + '/')) {
            return
          }

          // how: top-level accordion collapses other top-level items in same branch
          if (parentPath === '') {
            const pTopLevel = p.split('/')[0]
            const pathTopLevel = segments[0]
            if (pTopLevel === pathTopLevel && p !== pathKey) {
              return
            }
          }

          next.add(p)
        })

        next.add(pathKey)

        return next
      })
    },
    []
  )

  const contextValue = useMemo(() => ({ expandedSections, toggleSection }), [expandedSections, toggleSection])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>

      {/* Mobile Menu Overlay - rendered via portal to escape header's stacking context */}
      {mounted &&
        isOpen &&
        createPortal(
          <div className="fixed inset-0 top-16 z-[60] bg-white dark:bg-slate-900 md:hidden">
            <div className="h-full overflow-y-auto px-4 pb-6 pt-4">
              {/* Main Navigation */}
              <div className="mb-6 border-b border-slate-200 pb-6 dark:border-slate-700">
                <ul className="space-y-1">
                  {mainNavLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={`block rounded-lg px-3 py-2 text-base font-medium ${
                          pathname === link.href || pathname.startsWith(link.href + '/')
                            ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Documentation Navigation */}
              <MobileNavContext.Provider value={contextValue}>
                <div className="space-y-4">
                  {navigation.map((section) => (
                    <MobileNavSection
                      key={section.title}
                      section={section}
                      pathname={pathname}
                      onClose={() => setIsOpen(false)}
                      path={[section.title]}
                    />
                  ))}
                </div>
              </MobileNavContext.Provider>

              {/* Footer Actions */}
              <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6 dark:border-slate-700">
                <span className="text-sm text-slate-500 dark:text-slate-400">Toggle theme</span>
                <ThemeToggle />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

/** Props for the inline {@link MobileNavSection} renderer */
type MobileNavSectionProps = {
  section: NavItem
  pathname: string
  onClose: () => void
  path: string[]
  depth?: number
}

function MobileNavSection({ section, pathname, onClose, path, depth = 0 }: MobileNavSectionProps) {
  const { expandedSections, toggleSection } = useMobileNavContext()
  const pathKey = path.join('/')
  const isOpen = expandedSections.has(pathKey)
  const hasChildren = section.children && section.children.length > 0
  const hasHref = Boolean(section.href)
  const isActive = section.href ? normalizePath(section.href) === normalizePath(pathname) : false

  const isChildActive = hasChildren && checkIfChildActive(section.children || [], pathname)

  if (!hasChildren) {
    return (
      <Link
        href={section.href || '#'}
        onClick={onClose}
        className={`block rounded-lg px-3 py-2 text-sm ${depth === 0 ? 'font-semibold' : ''} ${
          isActive
            ? 'border-l-[3px] border-primary-600 bg-primary-100/80 font-medium text-primary-700 dark:border-primary-400 dark:bg-primary-900/50 dark:text-primary-200'
            : depth === 0
              ? 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        {section.title}
      </Link>
    )
  }

  const handleToggle = () => toggleSection(pathKey)

  return (
    <div>
      <div
        className={`flex w-full items-center justify-between rounded-lg text-sm ${depth === 0 ? 'font-semibold' : ''} ${
          isActive
            ? 'border-l-[3px] border-primary-600 bg-primary-100/80 font-medium text-primary-700 dark:border-primary-400 dark:bg-primary-900/50 dark:text-primary-200'
            : isChildActive
              ? 'text-primary-600 dark:text-primary-400'
              : depth === 0
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
        }`}
      >
        {hasHref && section.href ? (
          <Link href={section.href} onClick={onClose} className="flex-1 px-3 py-2">
            {section.title}
          </Link>
        ) : (
          <button onClick={handleToggle} className="flex-1 px-3 py-2 text-left">
            {section.title}
          </button>
        )}
        <button
          onClick={handleToggle}
          className="px-3 py-2"
          aria-expanded={isOpen}
          aria-label={isOpen ? `Collapse ${section.title}` : `Expand ${section.title}`}
        >
          <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {isOpen && (
        <ul className="mt-1 space-y-1 border-l border-slate-200 pl-4 dark:border-slate-700">
          {section.children?.map((child) => (
            <li key={child.title}>
              {child.children && child.children.length > 0 ? (
                <MobileNavSection section={child} pathname={pathname} onClose={onClose} path={[...path, child.title]} depth={depth + 1} />
              ) : (
                <Link
                  href={child.href || '#'}
                  onClick={onClose}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    child.href && normalizePath(pathname) === normalizePath(child.href)
                      ? 'border-l-[3px] border-primary-600 bg-primary-100/80 font-medium text-primary-700 dark:border-primary-400 dark:bg-primary-900/50 dark:text-primary-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                  aria-current={child.href && normalizePath(pathname) === normalizePath(child.href) ? 'page' : undefined}
                >
                  {child.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function checkIfChildActive(children: NavItem[], pathname: string): boolean {
  const normalizedPathname = normalizePath(pathname)
  return children.some((child) => {
    if (child.href && normalizePath(child.href) === normalizedPathname) return true
    if (child.children) return checkIfChildActive(child.children, pathname)
    return false
  })
}

/** Common props for mobile-menu icons */
type IconProps = { className?: string }

function MenuIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
