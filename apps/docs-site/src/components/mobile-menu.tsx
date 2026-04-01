'use client'

import type { NavItem as SharedNavItem } from '../lib/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

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
              <div className="space-y-4">
                {navigation.map((section) => (
                  <MobileNavSection key={section.title} section={section} pathname={pathname} onClose={() => setIsOpen(false)} />
                ))}
              </div>

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

function MobileNavSection({
  section,
  pathname,
  onClose,
  depth = 0,
}: {
  section: NavItem
  pathname: string
  onClose: () => void
  depth?: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = section.children && section.children.length > 0

  const isChildActive = hasChildren && checkIfChildActive(section.children || [], pathname)

  if (!hasChildren) {
    return (
      <Link
        href={section.href || '#'}
        onClick={onClose}
        className={`block rounded-lg px-3 py-2 text-sm ${depth === 0 ? 'font-semibold' : ''} ${
          pathname === section.href
            ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
            : depth === 0
              ? 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        }`}
      >
        {section.title}
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${depth === 0 ? 'font-semibold' : ''} ${
          isChildActive
            ? 'text-primary-600 dark:text-primary-400'
            : depth === 0
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400'
        }`}
      >
        {section.title}
        <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <ul className="mt-1 space-y-1 pl-4">
          {section.children?.map((child) => (
            <li key={child.title}>
              {child.children && child.children.length > 0 ? (
                <MobileNavSection section={child} pathname={pathname} onClose={onClose} depth={depth + 1} />
              ) : (
                <Link
                  href={child.href || '#'}
                  onClick={onClose}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    pathname === child.href
                      ? 'bg-primary-50 font-medium text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
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
  return children.some((child) => {
    if (child.href === pathname) return true
    if (child.children) return checkIfChildActive(child.children, pathname)
    return false
  })
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
