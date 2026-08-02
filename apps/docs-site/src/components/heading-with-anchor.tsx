'use client'

import type { ReactNode, ElementType } from 'react'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { generateSlug } from '../lib/markdown'
import { AnchorLink } from './anchor-link'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

interface HeadingWithAnchorProps {
  /**
   * Heading level (1-6), determines the HTML element (h1-h6)
   */
  level: HeadingLevel
  /**
   * Optional explicit ID for the anchor. If not provided, generates from children text.
   */
  id?: string
  /**
   * Additional CSS classes for the heading element
   */
  className?: string
  /**
   * Heading content
   */
  children: ReactNode
}

const headingElements: Record<HeadingLevel, ElementType> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
}

/**
 * Extracts text content from React children recursively.
 * Used to generate slug IDs from heading content.
 * @param children
 */
function getTextFromChildren(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (!children) return ''

  if (isArray(children)) {
    return children.map(getTextFromChildren).join('')
  }

  if (typeof children === 'object' && 'props' in children) {
    const props = children.props
    if (typeof props === 'object' && props !== null && 'children' in props) {
      return getTextFromChildren(props.children as ReactNode)
    }
  }

  return ''
}

/**
 * A heading component with an integrated, always-visible anchor link.
 * Clicking the anchor copies the URL to clipboard and updates the URL hash.
 * @param root0
 * @param root0.level
 * @param root0.id
 * @param root0.className
 * @param root0.children
 * @example
 * ```tsx
 * <HeadingWithAnchor level={2} className="text-2xl font-bold">
 *   Installation
 * </HeadingWithAnchor>
 * ```
 * @example
 * ```tsx
 * // With explicit ID
 * <HeadingWithAnchor level={2} id="custom-id">
 *   Section Title
 * </HeadingWithAnchor>
 * ```
 */
export function HeadingWithAnchor({ level, id, className = '', children }: HeadingWithAnchorProps) {
  const HeadingTag = headingElements[level]
  const generatedId = id ?? generateSlug(getTextFromChildren(children))

  return (
    <HeadingTag id={generatedId} className={`group flex items-center gap-2 scroll-mt-20 ${className}`}>
      {children}
      <AnchorLink id={generatedId} />
    </HeadingTag>
  )
}

/**
 * Convenience components for each heading level.
 * These provide a cleaner API when the level is known statically.
 * @param props
 */
export function H1(props: Omit<HeadingWithAnchorProps, 'level'>) {
  return <HeadingWithAnchor level={1} {...props} />
}

export function H2(props: Omit<HeadingWithAnchorProps, 'level'>) {
  return <HeadingWithAnchor level={2} {...props} />
}

export function H3(props: Omit<HeadingWithAnchorProps, 'level'>) {
  return <HeadingWithAnchor level={3} {...props} />
}

export function H4(props: Omit<HeadingWithAnchorProps, 'level'>) {
  return <HeadingWithAnchor level={4} {...props} />
}

export function H5(props: Omit<HeadingWithAnchorProps, 'level'>) {
  return <HeadingWithAnchor level={5} {...props} />
}

export function H6(props: Omit<HeadingWithAnchorProps, 'level'>) {
  return <HeadingWithAnchor level={6} {...props} />
}
