'use client'

import type { HighlightedCode } from '@/lib/code-tokens'
import { DWELL_MS, keystrokeInterval, nextCommand, nextKeystroke, visibleTokens } from '@/lib/cycling-code'
import { useEffect, useRef, useState } from 'react'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { CopyButton } from './copy-button'

/** Props for {@link CyclingCode}. */
export interface CyclingCodeProps {
  /** The commands, each highlighted, in the order they are cycled */
  frames: HighlightedCode[]
  /** The language label, shown in the corner when given */
  language?: string
}

/** Where the animation is. */
interface Cursor {
  /** Which command is on screen */
  index: number
  /** How many of its characters are shown */
  shown: number
}

/**
 * Whether the animation should run right now.
 *
 * It rests when nobody could see it, the tab is hidden or the block is off
 * screen, and when the reader is attending to it, the pointer resting on
 * it or focus inside it, because a command that changes under a reader who
 * is reading it or about to select it is an interruption. A reader who has
 * asked for less motion never sees it type at all.
 * @param visible - Whether the block is on screen
 * @param attended - Whether the pointer rests on it or focus is inside it
 * @returns True when the cycle may advance
 */
function mayRun(visible: boolean, attended: boolean): boolean {
  return visible && !attended && !document.hidden
}

/**
 * The client half of a cycling code block: what is on screen and what is
 * copied are two different things, and this is the part that keeps them so.
 *
 * The drawing shows a prefix of the current command, one character more
 * every few milliseconds, then holds the whole command for a while before
 * clearing for the next. The copy control is handed the whole current
 * command from the moment that command is chosen, so copying halfway
 * through the typing yields the complete command and never the fragment
 * that happens to be drawn. The server renders the first command whole, so
 * a reader without script, or before it runs, sees a valid command and
 * copies a valid command.
 *
 * A reader who has asked for less motion gets the commands whole, one after
 * another on the same dwell, with no character-by-character drawing.
 * @param props - See {@link CyclingCodeProps}.
 * @param props.frames - The commands, highlighted
 * @param props.language - The language label
 * @returns The block's inside: the highlighted `<pre>`, the label, and the copy control.
 */
export function CyclingCode({ frames, language }: CyclingCodeProps) {
  const first = frames[0]
  const [cursor, setCursor] = useState<Cursor>({ index: 0, shown: first?.code.length ?? 0 })
  const [running, setRunning] = useState(false)
  const [reduced, setReduced] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)
  const attendedRef = useRef(false)
  const visibleRef = useRef(false)

  // why: three signals decide whether the cycle runs, and each is read where it changes so the timer only ever starts from a true reading
  useEffect(() => {
    const block = blockRef.current
    if (block === null) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = (): void => setReduced(motion.matches)
    syncMotion()
    motion.addEventListener('change', syncMotion)

    const sync = (): void => setRunning(mayRun(visibleRef.current, attendedRef.current))
    const observer = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries.some((entry) => entry.isIntersecting)
        sync()
      },
      { threshold: 0.2 }
    )
    observer.observe(block)

    const attend = (): void => {
      attendedRef.current = true
      sync()
    }
    const release = (): void => {
      attendedRef.current = block.matches(':hover') || block.contains(document.activeElement)
      sync()
    }
    block.addEventListener('pointerenter', attend)
    block.addEventListener('pointerleave', release)
    block.addEventListener('focusin', attend)
    block.addEventListener('focusout', release)
    document.addEventListener('visibilitychange', sync)

    return () => {
      motion.removeEventListener('change', syncMotion)
      observer.disconnect()
      block.removeEventListener('pointerenter', attend)
      block.removeEventListener('pointerleave', release)
      block.removeEventListener('focusin', attend)
      block.removeEventListener('focusout', release)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  // why: every step is one timer, so pausing is letting the current timer lapse and resuming is scheduling the next step from wherever the cursor is
  useEffect(() => {
    if (!running || frames.length < 2) return
    const current = frames[cursor.index]
    if (current === undefined) return

    const complete = cursor.shown >= current.code.length
    if (reduced) {
      // why: without the typing there is nothing to animate, so the commands take turns whole
      const timer = setTimeout(
        () =>
          setCursor({
            index: nextCommand(cursor.index, frames.length),
            shown: frames[nextCommand(cursor.index, frames.length)]?.code.length ?? 0,
          }),
        DWELL_MS
      )
      return () => clearTimeout(timer)
    }
    if (complete) {
      const timer = setTimeout(() => setCursor({ index: nextCommand(cursor.index, frames.length), shown: 0 }), DWELL_MS)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(
      () => setCursor({ index: cursor.index, shown: nextKeystroke(cursor.shown, current.code.length) }),
      keystrokeInterval(current.code.length)
    )
    return () => clearTimeout(timer)
  }, [running, reduced, cursor, frames])

  const frame = frames[cursor.index] ?? first
  if (frame === undefined) return null
  const shown = reduced ? frame.code.length : cursor.shown

  return (
    <div ref={blockRef} className="cycling-code" data-typing={shown < frame.code.length ? 'true' : 'false'}>
      <pre className={frame.className} style={styleFrom(frame.rootStyle)} tabIndex={0}>
        <code>
          {frame.lines.map((line, lineIndex) => (
            <span key={lineIndex} className="line">
              {visibleTokens(line, shown).map((token, tokenIndex) => (
                <span key={tokenIndex} style={styleFrom(token.style)}>
                  {token.content}
                </span>
              ))}
              {lineIndex === frame.lines.length - 1 ? <span className="code-cursor" aria-hidden="true" /> : null}
            </span>
          ))}
        </code>
      </pre>
      {language ? (
        <span className="code-language" aria-hidden="true">
          {language}
        </span>
      ) : null}
      {/* why: the whole command, never the prefix on screen; what is typed is a drawing and what is copied is the command */}
      <CopyButton code={frame.code} />
      <span className="sr-only" aria-live="polite">
        {frame.code}
      </span>
    </div>
  )
}

/**
 * Turn Shiki's inline style text into the object React wants.
 *
 * The text is a run of `--shiki-light:#hex;--shiki-dark:#hex` custom
 * properties, which React passes through as written once they are keys.
 * @param text - The style text
 * @returns The style object
 */
function styleFrom(text: string): Record<string, string> {
  const style: Record<string, string> = {}
  for (const declaration of text.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator === -1) continue
    style[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim()
  }
  return style
}
