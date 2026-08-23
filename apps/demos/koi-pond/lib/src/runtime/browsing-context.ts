/**
 * What a koi app may learn about the browsing context it runs in.
 *
 * Both readings are about this frame itself: how the page embedding it relates
 * to its own origin, and how much memory the browser is willing to attribute to
 * it. Neither reads the shape of the frame tree to work out whether anything
 * embeds this app at all. That fact is a caller's to supply, because a page that
 * infers its own situation from the window above it is guessing, and the guess
 * is wrong the moment something other than a pond does the framing.
 */
import type { KoiMemoryState } from '../model/card.js'

/** The slice of the memory-measurement API a koi feels for. */
interface MemoryMeasurer {
  /**
   * Breaks this page's memory down by what the browser can attribute it to.
   *
   * @returns The breakdown, once the browser has taken its sample.
   */
  measureUserAgentSpecificMemory?: () => Promise<{
    breakdown: { bytes: number; attribution: { url?: string }[] }[]
  }>
}

/** What a frame's own memory reading found. */
export interface KoiMemoryReading {
  /** Memory attributed to this app's own browsing context, in bytes, when measured. */
  bytes: number | null
  /** How the reading stands. */
  state: KoiMemoryState
}

/**
 * How this app's origin relates to the page embedding it.
 *
 * @param hosted - Whether anything embeds this app at all.
 * @returns The relation, or `null` when nothing embeds it.
 *
 * @example Telling a card where its app is running
 * ```typescript
 * const origin = originRelation(feature.hosted)
 * ```
 */
export function originRelation(hosted: boolean): 'same-origin' | 'cross-origin' | null {
  if (!hosted) {
    return null
  }
  try {
    return new URL(document.referrer).origin === window.location.origin ? 'same-origin' : 'cross-origin'
  } catch {
    // why: A referrer this frame cannot read is one a different origin sent, which is the honest reading when the embedding page kept it to itself.
    return 'cross-origin'
  }
}

/**
 * Measures this app's own memory, honestly or not at all.
 *
 * `performance.measureUserAgentSpecificMemory` runs only in cross-origin
 * isolated pages and attributes per browsing context, so the reading keeps the
 * entries attributed to this app's own directory and refuses to guess when the
 * API, the isolation, or the attribution is missing. A failed measurement is a
 * reading of `unavailable` rather than an error a caller has to handle.
 *
 * @param url - This app's own directory URL, which its entries are attributed to.
 * @returns What the browser was willing to attribute, and how the reading stands.
 *
 * @example Reading a frame's own heap
 * ```typescript
 * const reading = await measureOwnMemory(new URL('.', window.location.href).href)
 * ```
 */
export async function measureOwnMemory(url: string): Promise<KoiMemoryReading> {
  try {
    const measurer = (<MemoryMeasurer>performance).measureUserAgentSpecificMemory
    if (measurer === undefined || !window.crossOriginIsolated) {
      return { bytes: null, state: 'unavailable' }
    }
    const result = await measurer.call(performance)
    let bytes = 0
    let attributed = false
    for (const entry of result.breakdown) {
      if (entry.attribution.some((source) => typeof source.url === 'string' && source.url.startsWith(url))) {
        bytes += entry.bytes
        attributed = true
      }
    }
    // why: A share of somebody else's heap is not this frame's memory, so a breakdown with nothing attributed here reads as unavailable rather than as zero.
    return attributed ? { bytes, state: 'measured' } : { bytes: null, state: 'unavailable' }
  } catch {
    return { bytes: null, state: 'unavailable' }
  }
}
