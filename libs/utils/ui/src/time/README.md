# time

Animation-frame–based pause and timestamp formatting helpers.

`pause(ms)` returns a promise that resolves after the requested duration, scheduled via `requestAnimationFrame` so the wait stays in sync with the browser's render cycle and is automatically suspended when the tab is backgrounded. `timestampToDateTime` formats a millisecond timestamp into a human-readable date-time string suitable for log lines, debug overlays, and UI labels that prefer a stable, locale-independent shape.
