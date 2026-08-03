import type { NavIconKind } from '../lib/navigation'

/** Paths to the light- and dark-theme asset for a single nav icon kind. */
interface IconSourcePair {
  light: string
  dark: string
}

/** Light/dark asset pair for each nav icon kind, served from `public/nav`. */
const ICON_SOURCES: Record<NavIconKind, IconSourcePair> = {
  package: { light: '/nav/package-light.svg', dark: '/nav/package-dark.svg' },
  architecture: { light: '/nav/architecture-light.svg', dark: '/nav/architecture-dark.svg' },
  submodule: { light: '/nav/submodule-light.svg', dark: '/nav/submodule-dark.svg' },
}

/** Props for {@link NavItemIcon}. */
interface NavItemIconProps {
  /** Whether the entry is a published package, an architecture document, or a nested submodule. */
  kind: NavIconKind
  /** Sizing classes for the icon. Defaults to `h-5 w-5`. */
  className?: string
}

/**
 * Decorative icon shown next to package, architecture-document, and submodule
 * labels in the docs navigation. Renders both theme variants and swaps them
 * with the `.dark` class (same `block dark:hidden` / `hidden dark:block`
 * pattern as the logo), so it stays correct without client-side theme
 * detection.
 * @param root0 - The props object.
 * @param root0.kind - Whether the entry is a package, an architecture document, or a submodule.
 * @param root0.className - Sizing classes for the icon.
 * @returns The themed nav icon.
 */
export function NavItemIcon({ kind, className = 'h-5 w-5' }: NavItemIconProps) {
  const src = ICON_SOURCES[kind]
  const shared = `${className} shrink-0`
  return (
    <>
      <img src={src.light} alt="" aria-hidden="true" className={`${shared} block dark:hidden`} />
      <img src={src.dark} alt="" aria-hidden="true" className={`${shared} hidden dark:block`} />
    </>
  )
}
