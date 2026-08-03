'use client'

import type { TypeSegment } from './type-utils'
import type { TypeRef } from './types'
import { Fragment } from 'react'
import { useTypeLinkResolver } from './api-link-context'
import { renderTypeSegments } from './type-utils'

/** Props for {@link TypeSegmentsText}. */
interface TypeSegmentsTextProps {
  /** The rendered type segments to display */
  segments: TypeSegment[]
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
          <Fragment key={index}>{segment.text}</Fragment>
        )
      )}
    </>
  )
}

interface TypeLinkProps {
  type: TypeRef | undefined
}

export function TypeLink({ type }: TypeLinkProps) {
  const resolve = useTypeLinkResolver()

  return (
    <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
      <TypeSegmentsText segments={renderTypeSegments(type, resolve)} />
    </code>
  )
}
