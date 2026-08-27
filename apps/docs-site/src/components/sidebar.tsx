'use client'

import type { NavIconKind, NavItem as SharedNavItem } from '../lib/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { docsNavigation, getNavIconKind } from '../lib/navigation'
import { NavItemIcon } from './nav-item-icon'

interface NavItem {
  title: string
  href?: string
  children?: NavItem[]
  iconKind?: NavIconKind | null
}

/**
 * Converts shared navigation items to sidebar-specific format.
 * Uses the slug as the display title (without `@hyperfrontend/` prefix) and
 * bakes in the package/submodule icon kind for each entry.
 * @param items - The shared navigation items to convert
 * @param insidePackage - Whether the items live inside a package subtree
 * @returns The converted navigation items for sidebar
 */
function convertToSidebarNav(items: SharedNavItem[], insidePackage = false): NavItem[] {
  return items.map((item) => ({
    title: item.slug,
    href: item.href,
    iconKind: getNavIconKind(item, insidePackage),
    children: item.children ? convertToSidebarNav(item.children, insidePackage || Boolean(item.packageName)) : undefined,
  }))
}

const navigation = convertToSidebarNav(docsNavigation)

/** Context for managing which section is expanded (only one at a time per depth level) */
interface SidebarContextValue {
  expandedPath: string[]
  setExpandedPath: (path: string[]) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebarContext() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw createError('SidebarItem must be used within Sidebar')
  return ctx
}

/**
 * Match descriptor used while resolving the current sidebar path: the chain of
 * titles, the matched href length, and whether it was an exact-path hit.
 */
type SidebarMatch = {
  path: string[]
  hrefLength: number
  exact: boolean
}

/**
 * Finds all potential matches for the current pathname and returns the most specific one.
 * @param items
 * @param pathname
 * @param currentPath
 */
function findAllMatches(items: NavItem[], pathname: string, currentPath: string[] = []): Array<SidebarMatch> {
  const normalizedPathname = pathname.replace(/\/$/, '')
  const matches: Array<SidebarMatch> = []

  for (const item of items) {
    const itemPath = [...currentPath, item.title]
    const normalizedHref = item.href?.replace(/\/$/, '') ?? ''

    // how: check exact match
    if (normalizedHref === normalizedPathname) {
      matches.push({ path: itemPath, hrefLength: normalizedHref.length, exact: true })
    }
    // how: check prefix match
    else if (normalizedHref && normalizedPathname.startsWith(normalizedHref + '/')) {
      matches.push({ path: itemPath, hrefLength: normalizedHref.length, exact: false })
    }

    // how: always search children too
    if (item.children) {
      matches.push(...findAllMatches(item.children, pathname, itemPath))
    }
  }

  return matches
}

/**
 * Returns the path to the currently active navigation item, allowing auto-expansion
 * of the section containing the current page.
 * Finds the most specific (longest href) match across all items.
 * @param items
 * @param pathname
 */
function getActivePath(items: NavItem[], pathname: string): string[] | null {
  const matches = findAllMatches(items, pathname)

  if (matches.length === 0) return null

  // how: prioritize exact matches, then longest href (most specific prefix)
  matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1
    return b.hrefLength - a.hrefLength
  })

  return matches[0].path
}

/**
 * Normalizes a pathname by removing trailing slashes for comparison.
 * @param path - The path to normalize
 */
function normalizePath(path: string): string {
  return path.replace(/\/$/, '')
}

/** Local storage key for sidebar collapsed state */
const SIDEBAR_COLLAPSED_KEY = 'docs-sidebar-collapsed'

export function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === 'true') setIsCollapsed(true)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const initialPath = useMemo(() => getActivePath(navigation, pathname) ?? [], [pathname])
  const [expandedPath, setExpandedPath] = useState<string[]>(initialPath)

  useEffect(() => {
    const newPath = getActivePath(navigation, pathname)
    if (newPath) {
      setExpandedPath(newPath)
    }
  }, [pathname])

  const contextValue = useMemo(() => ({ expandedPath, setExpandedPath }), [expandedPath])

  return (
    <div className="relative flex">
      {/* Sidebar content */}
      <div
        className={`border-r border-slate-200 pr-8 transition-all duration-300 ease-in-out dark:border-slate-700 ${isCollapsed ? 'w-0 overflow-hidden border-r-0 pr-0 opacity-0' : 'w-64 opacity-100'}`}
      >
        <SidebarContext.Provider value={contextValue}>
          <nav
            className="h-[calc(100vh-5rem)] w-64 shrink-0 overflow-y-auto py-10"
            aria-label="Documentation navigation"
            aria-hidden={isCollapsed}
          >
            <ul className="mr-3 space-y-2" role="list">
              {navigation.map((item) => (
                <SidebarItem key={item.title} item={item} pathname={pathname} path={[item.title]} />
              ))}
            </ul>
          </nav>
        </SidebarContext.Provider>
      </div>

      {/* Collapse/Expand toggle tab - positioned to the right of the border */}
      <button
        onClick={toggleCollapsed}
        className="sticky top-28 z-10 -ml-px flex h-16 w-5 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <CollapseIcon className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

/** Props for the inline {@link SidebarItem} renderer */
type SidebarItemProps = { item: NavItem; pathname: string; path: string[] }

function SidebarItem({ item, pathname, path }: SidebarItemProps) {
  const { expandedPath, setExpandedPath } = useSidebarContext()
  const hasChildren = item.children && item.children.length > 0
  const isActive = item.href ? normalizePath(item.href) === normalizePath(pathname) : false
  const depth = path.length - 1

  const isExpanded = expandedPath.length >= path.length && path.every((seg, i) => expandedPath[i] === seg)

  const sectionId = `sidebar-section-${item.title.toLowerCase().replace(/\s+/g, '-')}`

  const handleToggle = useCallback(() => {
    // how: check if this exact item is the deepest expanded (not just an ancestor)
    const isExactMatch = expandedPath.length === path.length && path.every((seg, i) => expandedPath[i] === seg)
    const isAncestorOfExpanded = expandedPath.length > path.length && path.every((seg, i) => expandedPath[i] === seg)

    if (isExactMatch) {
      // how: clicking the currently deepest expanded item collapses it
      setExpandedPath(path.slice(0, -1))
    } else if (isAncestorOfExpanded) {
      // how: clicking an ancestor collapses children but keeps this level expanded
      setExpandedPath(path)
    } else {
      // how: expanding a new path (sibling or nested) auto-collapses siblings via prefix check
      setExpandedPath(path)
    }
  }, [expandedPath, path, setExpandedPath])

  if (hasChildren) {
    const hasHref = Boolean(item.href)

    return (
      <li>
        <div
          className={`flex w-full items-center justify-between rounded-lg text-sm transition-colors ${
            isActive
              ? 'border-l-[3px] border-primary-600 bg-primary-100/80 font-medium text-primary-700 dark:border-primary-400 dark:bg-primary-900/50 dark:text-primary-200'
              : isExpanded
                ? 'font-semibold text-primary-600 dark:text-primary-400'
                : depth === 0
                  ? 'font-semibold text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          {hasHref && item.href ? (
            <Link href={item.href} className="flex flex-1 items-center gap-2 px-3 py-2" aria-current={isActive ? 'page' : undefined}>
              {item.iconKind && <NavItemIcon kind={item.iconKind} />}
              {item.title}
            </Link>
          ) : (
            <button onClick={handleToggle} className="flex flex-1 items-center gap-2 px-3 py-2 text-left">
              {item.iconKind && <NavItemIcon kind={item.iconKind} />}
              {item.title}
            </button>
          )}
          <button
            onClick={handleToggle}
            aria-expanded={isExpanded}
            aria-controls={sectionId}
            aria-label={isExpanded ? `Collapse ${item.title}` : `Expand ${item.title}`}
            className="px-3 py-2"
          >
            <ChevronIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
        {isExpanded && (
          <ul id={sectionId} className="mt-1 space-y-1 border-l border-slate-200 pl-4 dark:border-slate-700" role="list">
            {item.children?.map((child) => (
              <SidebarItem key={child.title} item={child} pathname={pathname} path={[...path, child.title]} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <li>
      <Link
        href={item.href || '#'}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'border-l-[3px] border-primary-600 bg-primary-100/80 font-medium text-primary-700 dark:border-primary-400 dark:bg-primary-900/50 dark:text-primary-200'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        {item.iconKind && <NavItemIcon kind={item.iconKind} />}
        {item.title}
      </Link>
    </li>
  )
}

/** Common props for sidebar icons */
type IconProps = { className?: string }

function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function CollapseIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}
