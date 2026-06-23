import Link from 'next/link'
import { MobileMenu } from './mobile-menu'
import { ThemeToggle } from './theme-toggle'

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <MobileMenu />
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <span className="font-display text-xl font-bold text-slate-900 dark:text-white">HyperFrontend</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <NavLink href="/docs">Docs</NavLink>
          <NavLink href="/demos">Demos</NavLink>
          <NavLink href="/architecture">Architecture</NavLink>
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <a
            href="https://github.com/AndrewRedican/hyperfrontend"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <GitHubIcon className="h-6 w-6" />
          </a>
        </div>
      </div>
    </header>
  )
}

type NavLinkProps = { href: string; children: React.ReactNode }

function NavLink({ href, children }: NavLinkProps) {
  return (
    <Link href={href} className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
      {children}
    </Link>
  )
}

type IconProps = { className?: string }

function Logo({ className }: IconProps) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hf-light.svg" alt="HyperFrontend logo" className={`${className ?? ''} block dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hf-dark.svg" alt="" aria-hidden="true" className={`${className ?? ''} hidden dark:block`} />
    </>
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
