'use client'

import { useEffect, useRef, useState } from 'react'
import { ceil, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** The DevHunt listing the launch banner links to. */
const DEVHUNT_TOOL_URL = 'https://devhunt.org/tool/hyperfrontend'

/** DevHunt's hosted banner script; it reads the listing URL from the `data-url` attribute of its own tag. */
const DEVHUNT_BANNER_SRC = 'https://cdn.jsdelivr.net/gh/sidiDev/devhunt-banner/indexV0.js'

/** Type of the message the framed document posts whenever the banner's height changes. */
const HEIGHT_MESSAGE = 'devhunt-banner:height'

/** Message the page sends the frame to ask for a fresh height report, since the frame can finish loading before the page is listening. */
const MEASURE_MESSAGE = 'devhunt-banner:measure'

/** Tallest the frame may grow, so nothing running inside it can push the page down. */
const MAX_HEIGHT = 160

/**
 * The document the frame loads: DevHunt's script, which prepends its banner to
 * this document's body on load, followed by a reporter that posts the body's
 * height to the parent page every time it changes and whenever the page asks.
 */
const FRAME_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}</style></head><body><script defer data-url="${DEVHUNT_TOOL_URL}" src="${DEVHUNT_BANNER_SRC}"></script><script>function report(){parent.postMessage({type:'${HEIGHT_MESSAGE}',height:document.body.scrollHeight},'*')}new ResizeObserver(report).observe(document.body);addEventListener('message',function(e){if(e.source===parent&&e.data==='${MEASURE_MESSAGE}')report()})</script></body></html>`

/** Fields of a message from the frame, each still unverified until {@link readHeight} checks it. */
type FrameMessage = {
  /** Expected to equal {@link HEIGHT_MESSAGE}. */
  type?: unknown
  /** Expected to be the banner's height in pixels. */
  height?: unknown
}

/**
 * Reads a banner height out of a message posted by the frame.
 * @param data - The message payload
 * @returns The height in pixels, or `null` when the payload is not a height report
 */
function readHeight(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null
  const { type, height } = data as FrameMessage
  if (type !== HEIGHT_MESSAGE || typeof height !== 'number' || !isFinite(height)) return null
  return max(0, min(ceil(height), MAX_HEIGHT))
}

/**
 * DevHunt's launch banner: a dark "We are live on DevHunt" bar above the
 * sticky header, linking to the HyperFrontend listing.
 *
 * DevHunt's script injects a global CSS reset along with its markup, and an
 * unlayered reset outranks every Tailwind utility on the page. So the script
 * runs inside a sandboxed frame instead of this document: its styles reach
 * only its own markup, and without `allow-same-origin` it cannot touch this
 * page, its storage, or its cookies. The frame starts at zero height and takes
 * the banner's height from the reports the framed document posts.
 *
 * The banner is a launch-window fixture: remove this component from the root
 * layout once the contest is over.
 * @returns The sandboxed frame that hosts the banner
 */
export function DevHuntBanner() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const reported = readHeight(event.data)
      if (reported !== null) setHeight(reported)
    }
    window.addEventListener('message', onMessage)
    // why: the frame may have loaded and reported before this listener existed, so ask it to report again
    frame.current?.contentWindow?.postMessage(MEASURE_MESSAGE, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <iframe
      ref={frame}
      title="HyperFrontend on DevHunt"
      srcDoc={FRAME_DOCUMENT}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      className="block w-full border-0 print:hidden"
      style={{ height }}
    />
  )
}
