'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ThemeToggle } from './theme-toggle'

interface NavItem {
  title: string
  href?: string
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    title: 'Getting Started',
    children: [
      { title: 'Installation', href: '/docs' },
      { title: 'Quick Start', href: '/docs/quick-start' },
      { title: 'Core Concepts', href: '/docs/core-concepts' },
    ],
  },
  {
    title: 'Libraries',
    children: [
      { title: '@hyperfrontend/nexus', href: '/docs/libraries/nexus' },
      { title: '@hyperfrontend/network-protocol', href: '/docs/libraries/network-protocol' },
      { title: '@hyperfrontend/cryptography', href: '/docs/libraries/cryptography' },
      { title: '@hyperfrontend/state-machine', href: '/docs/libraries/state-machine' },
      { title: '@hyperfrontend/web-worker', href: '/docs/libraries/web-worker' },
      { title: '@hyperfrontend/utils', href: '/docs/libraries/utils' },
      { title: '@hyperfrontend/logging', href: '/docs/libraries/logging' },
    ],
  },
  {
    title: 'Plugins',
    children: [{ title: '@hyperfrontend/features', href: '/docs/plugins/features' }],
  },
  {
    title: 'API Reference',
    href: '/docs/api',
  },
  {
    title: 'Contributing',
    href: '/docs/contributing',
  },
]

const mainNavLinks = [
  { title: 'Docs', href: '/docs' },
  { title: 'Demos', href: '/demos' },
  { title: 'Architecture', href: '/architecture' },
]

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
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

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 top-16 z-50 bg-white dark:bg-slate-900 md:hidden">
          <div className="h-full overflow-y-auto px-4 pb-6 pt-4">
            {/* Main Navigation */}
            <div className="mb-6 border-b border-slate-200 pb-6 dark:border-slate-700">
              <ul className="space-y-1">
                {mainNavLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
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
                <MobileNavSection key={section.title} section={section} pathname={pathname} />
              ))}
            </div>

            {/* Footer Actions */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6 dark:border-slate-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">Toggle theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MobileNavSection({ section, pathname }: { section: NavItem; pathname: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = section.children && section.children.length > 0
  const isChildActive = hasChildren && section.children?.some((child) => child.href === pathname)

  if (!hasChildren) {
    return (
      <Link
        href={section.href || '#'}
        className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
          pathname === section.href
            ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
            : 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800'
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
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
          isChildActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white'
        }`}
      >
        {section.title}
        <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <ul className="mt-1 space-y-1 pl-4">
          {section.children?.map((child) => (
            <li key={child.title}>
              <Link
                href={child.href || '#'}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname === child.href
                    ? 'bg-primary-50 font-medium text-primary-600 dark:bg-primary-950/50 dark:text-primary-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {child.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
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
