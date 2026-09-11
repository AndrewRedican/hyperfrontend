import type { ReactNode } from 'react'
import { Fragment } from 'react'

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
