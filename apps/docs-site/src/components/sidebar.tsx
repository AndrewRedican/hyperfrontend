'use client'

import type { NavItem as SharedNavItem } from '../lib/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { docsNavigation } from '../lib/navigation'

interface NavItem {
  title: string
  href?: string
  children?: NavItem[]
}

/**
 * Converts shared navigation items to sidebar-specific format.
 * Uses the slug as the display title (without `@hyperfrontend/` prefix).
 * @param items - The shared navigation items to convert
 * @returns The converted navigation items for sidebar
 */
function convertToSidebarNav(items: SharedNavItem[]): NavItem[] {
  return items.map((item) => ({
    title: item.slug,
    href: item.href,
    children: item.children ? convertToSidebarNav(item.children) : undefined,
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
 * Returns the path to the currently active navigation item, allowing auto-expansion
 * of the section containing the current page.
 * @param items
 * @param pathname
 * @param currentPath
 */
function getActivePath(items: NavItem[], pathname: string, currentPath: string[] = []): string[] | null {
  for (const item of items) {
    const itemPath = [...currentPath, item.title]
    if (item.href === pathname) return itemPath
    if (item.href && pathname.startsWith(item.href + '/')) return itemPath
    if (item.children) {
      const childPath = getActivePath(item.children, pathname, itemPath)
      if (childPath) return childPath
    }
  }
  return null
}

export function Sidebar() {
  const pathname = usePathname()

  const initialPath = useMemo(() => getActivePath(navigation, pathname) ?? [], [pathname])
  const [expandedPath, setExpandedPath] = useState<string[]>(initialPath)

  const contextValue = useMemo(() => ({ expandedPath, setExpandedPath }), [expandedPath])

  return (
    <SidebarContext.Provider value={contextValue}>
      <nav className="sticky top-20 h-[calc(100vh-5rem)] w-64 shrink-0 overflow-y-auto py-10" aria-label="Documentation navigation">
        <ul className="space-y-2" role="list">
          {navigation.map((item) => (
            <SidebarItem key={item.title} item={item} pathname={pathname} path={[item.title]} />
          ))}
        </ul>
      </nav>
    </SidebarContext.Provider>
  )
}

function SidebarItem({ item, pathname, path }: { item: NavItem; pathname: string; path: string[] }) {
  const { expandedPath, setExpandedPath } = useSidebarContext()
  const hasChildren = item.children && item.children.length > 0
  const isActive = item.href === pathname
  const depth = path.length - 1

  const isExpanded = expandedPath.length >= path.length && path.every((seg, i) => expandedPath[i] === seg)

  const sectionId = `sidebar-section-${item.title.toLowerCase().replace(/\s+/g, '-')}`

  const handleToggle = useCallback(() => {
    if (isExpanded) {
      setExpandedPath(path.slice(0, -1))
    } else {
      setExpandedPath(path)
    }
  }, [isExpanded, path, setExpandedPath])

  if (hasChildren) {
    const hasHref = Boolean(item.href)

    return (
      <li>
        <div
          className={`flex w-full items-center justify-between rounded-lg text-sm transition-colors ${
            isActive
              ? 'bg-primary-50 font-medium text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
              : isExpanded
                ? 'font-semibold text-primary-600 dark:text-primary-400'
                : depth === 0
                  ? 'font-semibold text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          {hasHref && item.href ? (
            <Link href={item.href} className="flex-1 px-3 py-2">
              {item.title}
            </Link>
          ) : (
            <button onClick={handleToggle} className="flex-1 px-3 py-2 text-left">
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
        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-primary-50 font-medium text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        {item.title}
      </Link>
    </li>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
