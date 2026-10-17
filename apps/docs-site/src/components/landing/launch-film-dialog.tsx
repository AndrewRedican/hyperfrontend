'use client'

import { useEffect, useRef } from 'react'
import { noop } from '@hyperfrontend/function-utils'
import { LAUNCH_FILM } from './discovery-model'

/** Props for {@link LaunchFilmDialog}. */
interface LaunchFilmDialogProps {
  /** Whether the player is open */
  open: boolean
  /** Called when the viewer closes it, by the button, the backdrop, or Escape */
  onClose: () => void
}

/**
 * The launch film in a modal player.
 *
 * A native dialog, so focus is held inside it, Escape closes it, and focus
 * returns to the tile that opened it without any of that being written here.
 * The video loads nothing until the dialog opens: the tile shows the poster,
 * and the file behind it is fetched the moment playback is asked for, not
 * when the page is. Closing pauses playback rather than destroying the
 * element, so reopening resumes where the viewer left off.
 * @param props - See {@link LaunchFilmDialogProps}.
 * @param props.open - Whether the player is open
 * @param props.onClose - Called when the viewer closes it
 * @returns The dialog, closed until asked for.
 */
export function LaunchFilmDialog({ open, onClose }: LaunchFilmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const video = videoRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
      // why: autoplay on open is what the viewer asked for by pressing play; the promise rejects only when the browser forbids it, and the controls are already on screen for that case
      video?.play().catch(noop)
      return
    }
    // why: Escape closes a native dialog before anything here hears of it, so the pause cannot wait on the dialog still being open
    video?.pause()
    if (dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="launch-film"
      aria-label={LAUNCH_FILM.title}
      onClose={onClose}
      onClick={(event) => {
        // why: a click on the dialog element itself is a click on the backdrop; anything inside the frame is a click on the player
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="launch-film__frame">
        <video
          ref={videoRef}
          className="launch-film__video"
          controls
          playsInline
          preload="none"
          poster={LAUNCH_FILM.poster}
          aria-label={LAUNCH_FILM.title}
        >
          <source src={LAUNCH_FILM.src} type="video/mp4" />
          Your browser cannot play this video. {LAUNCH_FILM.title}
        </video>
        <button type="button" className="launch-film__close" onClick={onClose} aria-label="Close the film">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </dialog>
  )
}
