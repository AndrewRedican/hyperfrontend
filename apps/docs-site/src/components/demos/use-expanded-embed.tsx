'use client'

import type { DemoShell } from './demo-wiring'
import type { DemoScene, StagedSession } from './expand-choreography'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CARD_SESSION, stageHandover, stageScene } from './expand-choreography'

/** Inputs for {@link useExpandedEmbed}. */
export interface ExpandedEmbedOptions {
  /** `true` when the staged demo offers expansion at all. */
  expandable: boolean
  /** `true` when the staged demo is opened afresh for each scene instead of carrying one session across them. */
  reopens: boolean
  /** Identifies the demo currently holding the stage; a change collapses the overlay, whose session is torn down with the handover. */
  stageKey: number
  /** Also receives the shell handle, after the hook has taken its own subscriptions. */
  onShell?: (shell: DemoShell | null) => void
}

/** The expand-overlay state machine {@link useExpandedEmbed} returns. */
export interface ExpandedEmbed {
  /** `true` while the staged embed is stretched over the viewport. */
  expanded: boolean
  /** Names the session the surface must mount; pass it as the embed's React key. */
  sessionKey: number
  /** Stretches the staged demo over the viewport. */
  expand: () => void
  /** Collapses the overlay back into its frame. */
  collapse: () => void
  /** Drops the overlay because the stage is passing to another demo. */
  handOver: () => void
  /** Holds the staged demo's shell handle; pass as the embed's `onShell`. */
  holdShell: (shell: DemoShell | null) => void
}

/**
 * The expandable-embed state machine shared by every surface that can stretch
 * a running demo over the viewport.
 *
 * It owns the whole wire choreography. A session is told the scene it was
 * opened for the moment its handshake lands, so a feature that sizes its world
 * to the frame it was mounted in has the answer before it builds anything, and
 * a feature that reloads itself is told again on the fresh handshake. A demo
 * that carries one session across the scenes is told each change as it
 * happens; a demo that reopens hears nothing on the way out, because the
 * replacement announces its own scene. The hook also owns the `close-request`
 * subscription (once the visitor clicks into the feature frame, keydown lands
 * in the feature's document, so Escape reaches this window only as the
 * feature's close-request), the window-level Escape listener and body scroll
 * lock while expanded, and the collapse when the stage is handed to another
 * demo.
 * @param options - The staged demo's expandability, choreography, and stage identity.
 * @param options.expandable
 * @param options.reopens
 * @param options.stageKey
 * @param options.onShell
 * @returns The expand-overlay state and its controls.
 * @example Wiring a stage that can expand
 * ```tsx
 * const overlay = useExpandedEmbed({ expandable, reopens: entry.reopensOnExpand ?? false, stageKey: index })
 * <DemoEmbed key={overlay.sessionKey} frameless={overlay.expanded} onShell={overlay.holdShell} />
 * ```
 */
export function useExpandedEmbed({ expandable, reopens, stageKey, onShell }: ExpandedEmbedOptions): ExpandedEmbed {
  const [stage, setStage] = useState<StagedSession>(CARD_SESSION)

  // why: The stage is read from callbacks that must stay stable across renders, so the committed value is mirrored where they can reach it rather than closed over.
  const stageRef = useRef(stage)
  const applyStage = useCallback((next: StagedSession) => {
    stageRef.current = next
    setStage(next)
  }, [])

  // why: The scene cue crosses to the running feature as a contract action of its own, so the surface keeps its own handle on the staged shell.
  const shellRef = useRef<DemoShell | null>(null)

  const tellScene = useCallback(
    (scene: DemoScene) => {
      // why: Only an expandable demo has scene semantics in its contract; every other demo would be sent an action it never declared.
      if (expandable) {
        shellRef.current?.send('set-scene', { scene })
      }
    },
    [expandable]
  )

  const present = useCallback(
    (scene: DemoScene) => {
      const next = stageScene(stageRef.current, scene, reopens)
      if (next === stageRef.current) {
        return
      }
      if (next.generation === stageRef.current.generation) {
        // why: This session stays on the stage, so it is told the new scene itself. A session being replaced hears nothing: it is about to be destroyed, and its replacement is opened for the scene and says so on its own handshake.
        tellScene(scene)
      }
      applyStage(next)
    },
    [applyStage, reopens, tellScene]
  )

  const expand = useCallback(() => present('full'), [present])
  const collapse = useCallback(() => present('card'), [present])
  const handOver = useCallback(() => applyStage(stageHandover(stageRef.current)), [applyStage])

  const subscriptions = useRef<readonly (() => void)[]>([])
  const holdShell = useCallback(
    (shell: DemoShell | null) => {
      shellRef.current = shell
      subscriptions.current.forEach((unsubscribe) => unsubscribe())
      subscriptions.current = shell
        ? [
            // why: A session learns how it is being presented on the handshake that starts it, which is the last moment a feature can still decide what to build.
            shell.on('open', () => tellScene(stageRef.current.scene)),
            shell.on('close-request', collapse),
          ]
        : []
      onShell?.(shell)
    },
    [collapse, onShell, tellScene]
  )

  const expanded = stage.scene === 'full'

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

  // why: Handing the stage to another demo tears the expanded session down with it; the overlay must not linger over a stage that no longer owns it, and the demo arriving starts on a card of its own.
  useEffect(() => {
    applyStage(CARD_SESSION)
  }, [applyStage, stageKey])

  return { expanded, sessionKey: stage.generation, expand, collapse, handOver, holdShell }
}
