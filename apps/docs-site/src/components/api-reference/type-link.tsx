'use client'

import type { TypeSegment } from './type-utils'
import type { TypeRef } from './types'
import { CODE_WRAP_ATTRIBUTE, CODE_WRAP_FOLD } from '@/lib/code-span'
import { Fragment } from 'react'
import { useTypeLinkResolver } from './api-link-context'
import { renderTypeSegments } from './type-utils'

/** Characters a type or signature may fold after: an opening bracket, or the comma between members. */
const SOFT_BREAK_AFTER = '(<[,'

/** Props for {@link TypeSegmentsText}. */
interface TypeSegmentsTextProps {
  /** The rendered type segments to display */
  segments: TypeSegment[]
}

/**
 * A segment's punctuation with a soft break opportunity after each opening
 * bracket and comma.
 *
 * A signature is one word to the line breaker until its first space, and
 * `getFirstInvalidProtocolProperty(protocol:` is wider than a phone column,
 * so without an opportunity of its own the line would break inside the
 * identifier. A break after the bracket keeps the name whole and puts the
 * parameters on the next line, which is how a signature is folded by hand.
 * @param text - A plain segment of a type or signature
 * @returns The text with a soft break after every `(`, `<`, `[` and `,`
 */
function withSoftBreaks(text: string) {
  const pieces: string[] = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (SOFT_BREAK_AFTER.includes(text.charAt(index))) {
      pieces.push(text.slice(start, index + 1))
      start = index + 1
    }
  }
  // why: a segment is often the bracket alone, so the break is written after every piece that ends in one, the last included
  const tail = text.slice(start)
  return (
    <>
      {pieces.map((piece, index) => (
        <Fragment key={index}>
          {piece}
          <wbr />
        </Fragment>
      ))}
      {tail}
    </>
  )
}

/**
 * Renders type segments as inline text, linking every segment that carries a
 * destination — in-site anchors for hyperfrontend types, external docs for
 * platform, language, and Node built-ins.
 * @param props - Component props
 * @param props.segments - The rendered type segments to display
 * @returns The inline segment run
 */
export function TypeSegmentsText({ segments }: TypeSegmentsTextProps) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.href ? (
          <a
            key={index}
            href={segment.href}
            className="underline decoration-dotted decoration-1 underline-offset-2 hover:text-primary-600 dark:hover:text-primary-400"
            {...(segment.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {segment.text}
          </a>
        ) : (
          <Fragment key={index}>{withSoftBreaks(segment.text)}</Fragment>
        )
      )}
    </>
  )
}

/**
 * Attributes every code span holding a type expression carries: the span is a
 * line of code rather than a name, so it folds at its own spaces on a narrow
 * screen instead of holding to one line or breaking inside an identifier.
 */
export const TYPE_EXPRESSION_ATTRIBUTES = { [CODE_WRAP_ATTRIBUTE]: CODE_WRAP_FOLD } as const

interface TypeLinkProps {
  type: TypeRef | undefined
}

export function TypeLink({ type }: TypeLinkProps) {
  const resolve = useTypeLinkResolver()

  return (
    <code className="api-type text-emerald-600 dark:text-emerald-400" {...TYPE_EXPRESSION_ATTRIBUTES}>
      <TypeSegmentsText segments={renderTypeSegments(type, resolve)} />
    </code>
  )
}
