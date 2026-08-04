import type { KeyboardEvent, PointerEvent } from 'react'
import type { RhythmEvent, RhythmState } from './rhythm/rhythm-engine'
import { useEffect, useRef, useState } from 'react'
import { FrameworkBadge } from './components/FrameworkBadge'
import { Heart } from './components/Heart'
import { playBeat } from './components/heart-animation'
import { heartRhythm } from './state/heart-rhythm'

const STATE_LABELS: Record<RhythmState, string> = {
  beating: 'beating',
  suppressed: 'suppressed — keep holding to flatline',
  flatline: 'flatline — release to revive',
  recovering: 'recovering',
}

/**
 * The feature page: the anatomical heart as an interactive button with a
 * minimal rate/state readout underneath.
 *
 * @returns The feature UI.
 */
export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [rhythm, setRhythm] = useState<RhythmEvent>({
    state: heartRhythm.getState(),
    bpm: Math.round(heartRhythm.getPacingBpm()),
  })

  useEffect(() => {
    const offBeat = heartRhythm.onBeat(() => {
      if (svgRef.current !== null) {
        playBeat(svgRef.current)
      }
    })
    const offRhythm = heartRhythm.onRhythm((change) => {
      setRhythm(change)
    })
    return () => {
      offBeat()
      offRhythm()
    }
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // why: Capturing the pointer guarantees the matching release fires even when the pointer drifts off the heart mid-hold.
    event.currentTarget.setPointerCapture(event.pointerId)
    heartRhythm.press()
  }

  const endHold = () => {
    heartRhythm.release()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      // why: preventDefault stops the browser's synthetic click; Enter maps to one extra beat.
      event.preventDefault()
      heartRhythm.tap()
    }
    if (event.key === ' ' && !event.repeat) {
      // why: Space-hold mirrors the pointer hold, so suppression is keyboard-reachable.
      event.preventDefault()
      heartRhythm.press()
    }
  }

  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ') {
      event.preventDefault()
      heartRhythm.release()
    }
  }

  return (
    <main className={`stage rhythm-${rhythm.state}`}>
      <button
        type="button"
        className="heart-button"
        aria-label="Heart. Click or press Enter for an extra beat; hold the pointer or Space to suppress the rhythm."
        onPointerDown={onPointerDown}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <Heart svgRef={svgRef} />
      </button>
      <p className="readout">
        <span className="readout-bpm">{rhythm.bpm}</span> bpm · {STATE_LABELS[rhythm.state]}
      </p>
      <p className="hint">click / Enter: extra beat · hold: suppress · hold 4 s: flatline</p>
      <p className="sr-only" role="status" aria-live="polite">
        {`Heart rhythm ${rhythm.state} at ${rhythm.bpm} beats per minute.`}
      </p>
      <FrameworkBadge />
    </main>
  )
}
