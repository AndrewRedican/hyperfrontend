import type { KeyboardEvent, PointerEvent } from 'react'
import type { RhythmEvent, RhythmState } from './rhythm/rhythm-engine'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DialogCloseControls } from './components/DialogCloseControls'
import { FrameworkBadge } from './components/FrameworkBadge'
import { Heart } from './components/Heart'
import { playBeat } from './components/heart-animation'
import { featureUi } from './state/feature-ui'
import { heartAudio } from './state/heart-audio'
import { heartRhythm } from './state/heart-rhythm'
import { heartVitals } from './state/heart-vitals'

const STATE_LABELS: Record<RhythmState, string> = {
  beating: 'beating',
  suppressed: 'suppressed',
  flatline: 'flatline — release to revive',
  recovering: 'recovering',
}

/** How often the measured readout re-samples between beats, so decay stays visibly live. */
const READOUT_TICK_MS = 250

/**
 * The feature page: the anatomical heart as an interactive button with a
 * measured rate/state readout underneath. The number shown is never the
 * configured target — it is computed from the beats that actually happened,
 * so extra taps raise it, holds decay it, and recoveries climb back.
 *
 * @returns The feature UI.
 */
export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [rhythm, setRhythm] = useState<RhythmEvent>({
    state: heartRhythm.getState(),
    bpm: Math.round(heartRhythm.getPacingBpm()),
  })
  const [measuredBpm, setMeasuredBpm] = useState(() => heartVitals.readingAt(Date.now()))
  const [announcement, setAnnouncement] = useState('')
  const [soundOn, setSoundOn] = useState(heartAudio.isEnabled())
  const mode = useSyncExternalStore(featureUi.subscribe, featureUi.getMode)

  useEffect(() => {
    const offBeat = heartRhythm.onBeat((beat) => {
      if (svgRef.current !== null) {
        playBeat(svgRef.current)
      }
      // why: Animation, sound, and the measured readout all hang off this one beat stream — nothing reconstructs its own idea of the rhythm.
      heartAudio.playBeat()
      heartVitals.addBeat(beat.at)
      setMeasuredBpm(heartVitals.readingAt(Date.now()))
    })
    const offRhythm = heartRhythm.onRhythm((change) => {
      setRhythm(change)
      setAnnouncement(`Heart rhythm ${change.state}.`)
    })
    return () => {
      offBeat()
      offRhythm()
    }
  }, [])

  useEffect(() => {
    // why: Between beats the reading must keep moving — silence decays it toward 0 rather than freezing the last value.
    const ticker = setInterval(() => {
      setMeasuredBpm(heartVitals.readingAt(Date.now()))
    }, READOUT_TICK_MS)
    return () => clearInterval(ticker)
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
      // why: preventDefault stops the browser's synthetic click; Enter maps to one extra pulse.
      event.preventDefault()
      heartRhythm.tap()
    }
    if (event.key === ' ' && !event.repeat) {
      // why: Space-hold mirrors the pointer hold, so the pause is keyboard-reachable.
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

  const toggleSound = () => {
    if (soundOn) {
      heartAudio.disable()
      setSoundOn(false)
      return
    }
    // why: enable() runs inside this click so the browser's gesture requirement is satisfied; a refusal simply leaves the toggle off.
    void heartAudio.enable().then((running) => {
      setSoundOn(running)
    })
  }

  // why: Flatline is the one state where the honest reading is pinned — a stopped heart reads 0, not a tail of stale intervals.
  const shownBpm = rhythm.state === 'flatline' ? 0 : measuredBpm

  return (
    <main className={`stage rhythm-${rhythm.state}`}>
      {mode === 'dialog' ? (
        <DialogCloseControls
          onCloseRequest={() => {
            featureUi.requestClose()
          }}
        />
      ) : null}
      <button
        type="button"
        className="heart-button"
        aria-label="Heart. Tap or press Enter for an extra pulse; hold the pointer or Space to pause the rhythm."
        onPointerDown={onPointerDown}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <Heart svgRef={svgRef} />
      </button>
      <p className="readout">
        <span className="readout-bpm">{shownBpm}</span> bpm · {STATE_LABELS[rhythm.state]}
      </p>
      <p className="hint">Tap for +1 pulse · Hold to stop</p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {mode === null ? (
        <button
          type="button"
          className="sound-toggle"
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Disable heartbeat sound' : 'Enable heartbeat sound'}
          onClick={toggleSound}
        >
          {soundOn ? '♪ sound on' : '♪ sound off'}
        </button>
      ) : null}
      <FrameworkBadge />
    </main>
  )
}
