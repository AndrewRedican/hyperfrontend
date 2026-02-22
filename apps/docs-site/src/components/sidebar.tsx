'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

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
      { title: '@hyperfrontend/logging', href: '/docs/libraries/logging' },
      {
        title: 'Utils',
        children: [
          { title: '@hyperfrontend/data-utils', href: '/docs/libraries/utils/data' },
          { title: '@hyperfrontend/function-utils', href: '/docs/libraries/utils/function' },
          { title: '@hyperfrontend/immutable-api-utils', href: '/docs/libraries/utils/immutable-api' },
          { title: '@hyperfrontend/json-utils', href: '/docs/libraries/utils/json' },
          { title: '@hyperfrontend/list-utils', href: '/docs/libraries/utils/list' },
          { title: '@hyperfrontend/random-generator-utils', href: '/docs/libraries/utils/random-generator' },
          { title: '@hyperfrontend/string-utils', href: '/docs/libraries/utils/string' },
          { title: '@hyperfrontend/time-utils', href: '/docs/libraries/utils/time' },
          { title: '@hyperfrontend/ui-utils', href: '/docs/libraries/utils/ui' },
        ],
      },
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

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-64 shrink-0" aria-label="Documentation navigation">
      <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto pb-10">
        <ul className="space-y-2" role="list">
          {navigation.map((item) => (
            <SidebarItem key={item.title} item={item} pathname={pathname} />
          ))}
        </ul>
      </div>
    </nav>
  )
}

function SidebarItem({ item, pathname, depth = 0 }: { item: NavItem; pathname: string; depth?: number }) {
  const hasChildren = item.children && item.children.length > 0
  const isActive = item.href === pathname
  const isChildActive = hasChildren && item.children?.some((child) => child.href === pathname || pathname.startsWith(child.href || ''))

  const [isOpen, setIsOpen] = useState(isChildActive || depth === 0)
  const sectionId = `sidebar-section-${item.title.toLowerCase().replace(/\s+/g, '-')}`

  if (hasChildren) {
    return (
      <li>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={sectionId}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            isChildActive
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800'
          }`}
        >
          {item.title}
          <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        {isOpen && (
          <ul id={sectionId} className="mt-1 space-y-1 border-l border-slate-200 pl-4 dark:border-slate-700" role="list">
            {item.children?.map((child) => (
              <SidebarItem key={child.title} item={child} pathname={pathname} depth={depth + 1} />
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
