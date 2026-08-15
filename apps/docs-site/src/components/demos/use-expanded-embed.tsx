'use client'

import type { DemoShell } from './demo-wiring'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Inputs for {@link useExpandedEmbed}. */
export interface ExpandedEmbedOptions {
  /** `true` when the staged demo offers expansion at all. */
  expandable: boolean
  /** `true` while the staged embed is live; the scene cue is only meaningful to a running feature. */
  live: boolean
  /** Identifies the demo currently holding the stage; a change collapses the overlay, whose session is torn down with the handover. */
  stageKey: number
  /** Also receives the shell handle, after the hook has taken its own subscription. */
  onShell?: (shell: DemoShell | null) => void
}

/** The expand-overlay state machine {@link useExpandedEmbed} returns. */
export interface ExpandedEmbed {
  /** `true` while the staged embed is stretched over the viewport. */
  expanded: boolean
  /** Stretches the running embed over the viewport and tells the feature. */
  expand: () => void
  /** Collapses the overlay back into its frame and tells the feature. */
  collapse: () => void
  /** Holds the staged demo's shell handle; pass as the embed's `onShell`. */
  holdShell: (shell: DemoShell | null) => void
}

/**
 * The expandable-embed state machine shared by every surface that can stretch
 * a running demo over the viewport — the same live session, only a wider
 * window.
 *
 * It owns the whole wire choreography: the `set-scene` cue re-told on every
 * fresh proof of life so it survives feature reloads, the `close-request`
 * subscription (once the visitor clicks into the feature frame, keydown lands
 * in the feature's document — Escape reaches this window only as the
 * feature's close-request), the window-level Escape listener and body scroll
 * lock while expanded, and the collapse when the stage is handed to another
 * demo.
 * @param options - The staged demo's expandability, liveness, and stage identity.
 * @param options.expandable
 * @param options.live
 * @param options.stageKey
 * @param options.onShell
 * @returns The expand-overlay state and its controls.
 * @example Wiring a stage that can expand
 * ```tsx
 * const overlay = useExpandedEmbed({ expandable, live: status === 'live', stageKey: index })
 * <DemoEmbed frameless={overlay.expanded} onShell={overlay.holdShell} />
 * ```
 */
export function useExpandedEmbed({ expandable, live, stageKey, onShell }: ExpandedEmbedOptions): ExpandedEmbed {
  const [expanded, setExpanded] = useState(false)

  // why: The expand/collapse cue crosses to the running feature (a translucency hint, not a lifecycle event), so the surface keeps its own handle on the staged shell.
  const shellRef = useRef<DemoShell | null>(null)

  const setScene = useCallback((scene: 'card' | 'full') => {
    shellRef.current?.send('set-scene', { scene })
  }, [])

  const expand = useCallback(() => {
    setExpanded(true)
    setScene('full')
  }, [setScene])

  const collapse = useCallback(() => {
    setExpanded(false)
    setScene('card')
  }, [setScene])

  const closeRequestUnsub = useRef<(() => void) | null>(null)
  const holdShell = useCallback(
    (shell: DemoShell | null) => {
      shellRef.current = shell
      closeRequestUnsub.current?.()
      closeRequestUnsub.current = shell ? shell.on('close-request', collapse) : null
      onShell?.(shell)
    },
    [collapse, onShell]
  )

  // why: The presentation cue must survive feature reloads — every fresh proof of life re-tells the feature whether it is a masked card or the revealed overlay.
  useEffect(() => {
    if (live && expandable) {
      setScene(expanded ? 'full' : 'card')
    }
  }, [expandable, expanded, live, setScene])

  useEffect(() => {
    if (!expanded) {
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        collapse()
      }
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [expanded, collapse])

  // why: Handing the stage to another demo tears the expanded session down with it; the overlay must not linger over a stage that no longer owns it.
  useEffect(() => {
    setExpanded(false)
  }, [stageKey])

  return { expanded, expand, collapse, holdShell }
}
