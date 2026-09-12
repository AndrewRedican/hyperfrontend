import type { ReactNode } from 'react'
import { Fragment } from 'react'
import { PackageIcon } from './package-icon'

/** The scope every package here is published under, with its slash. */
const SCOPE_PREFIX = '@hyperfrontend/'

/**
 * A package name set so that a narrow screen breaks it at its slash.
 *
 * `@hyperfrontend/cryptography` is one word to the line breaker, and a phone
 * is not wide enough for it at a title's size. Every heading on the site may
 * break inside a word when nothing else fits, which keeps the page the width
 * of the phone; this offers the breaker a better place first, after each
 * slash, so the scope and the name land on separate lines whole and the
 * fallback break inside a word is taken only when even the name alone will
 * not fit.
 *
 * A function returning nodes rather than a component, so a heading that
 * derives its id from its children's text still reads the whole name: the
 * break opportunity is an element with no text, and the text around it is
 * exactly the name.
 * @param name - The name as written, `@hyperfrontend/cryptography` or a title that contains one
 * @returns The name with a break opportunity after each slash.
 * @example A package page title
 * ```tsx
 * <H1>{breakablePackageName('@hyperfrontend/cryptography')}</H1>
 * ```
 */
export function breakablePackageName(name: string): ReactNode[] {
  return name.split('/').map((segment, index) => (
    <Fragment key={index}>
      {index > 0 ? '/' : ''}
      {index > 0 ? <wbr /> : null}
      {segment}
    </Fragment>
  ))
}

/**
 * A package's title, as a page heading draws it at every width.
 *
 * On a wide screen it is the full name, broken at its slash if it must be.
 * On a phone the scope is what costs the width: `@hyperfrontend/` is
 * fifteen characters that every package shares and that say nothing about
 * this one, so it gives way to the package's own mark, the same mark the
 * navigation and the library index already identify the package by, drawn
 * at the heading's size and sitting where the scope sat.
 *
 * Only the rendering changes. The scope is hidden visually, not removed: a
 * screen reader still hears the whole name, the heading's id is still
 * derived from the whole name, and a link to `#hyperfrontendcryptography`
 * still lands. The mark is decorative and hidden from assistive technology,
 * because the name it stands for is right beside it.
 *
 * A function returning a node rather than a component, for the same reason
 * as {@link breakablePackageName}: the heading reads its own text out of
 * its children, and that text has to be the name.
 * @param name - The full package name, `@hyperfrontend/cryptography`
 * @returns The title, ready to be a heading's children.
 * @example A package page title
 * ```tsx
 * <H1>{packageTitle('@hyperfrontend/cryptography')}</H1>
 * ```
 */
export function packageTitle(name: string): ReactNode {
  if (!name.startsWith(SCOPE_PREFIX)) return breakablePackageName(name)
  const short = name.slice(SCOPE_PREFIX.length)
  return (
    <span className="package-title">
      <PackageIcon packageName={name} className="package-title__mark" />
      <span className="package-title__scope">{SCOPE_PREFIX}</span>
      <wbr />
      {short}
    </span>
  )
}
