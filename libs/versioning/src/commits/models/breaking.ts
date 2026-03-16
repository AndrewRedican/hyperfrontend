import { hyphenToSpace } from '../utils/replace-char'

/**
 * Breaking change information.
 */
export interface BreakingChange {
  /** Whether this is a breaking change */
  readonly isBreaking: boolean

  /** Description of the breaking change */
  readonly description?: string

  /** Source of the breaking change indicator */
  readonly source: 'subject' | 'footer' | 'none'
}

/**
 * Creates a breaking change from a subject indicator (!).
 *
 * @param description - Optional description of the breaking change
 * @returns A BreakingChange object with source 'subject'
 */
export function createBreakingFromSubject(description?: string): BreakingChange {
  return {
    isBreaking: true,
    description,
    source: 'subject',
  }
}

/**
 * Creates a breaking change from a footer.
 *
 * @param description - The description of the breaking change
 * @returns A BreakingChange object with source 'footer'
 */
export function createBreakingFromFooter(description: string): BreakingChange {
  return {
    isBreaking: true,
    description,
    source: 'footer',
  }
}

/**
 * Creates a non-breaking change.
 *
 * @returns A BreakingChange object indicating no breaking change
 */
export function createNonBreaking(): BreakingChange {
  return {
    isBreaking: false,
    source: 'none',
  }
}

/**
 * Checks if a footer key indicates a breaking change.
 *
 * @param key - The footer key to check
 * @returns True if the key indicates a breaking change
 */
export function isBreakingFooterKey(key: string): boolean {
  const normalized = hyphenToSpace(key.toUpperCase())
  return normalized === 'BREAKING CHANGE'
}
