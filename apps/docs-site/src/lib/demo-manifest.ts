/** Where the feature's origin sits relative to the docs-site host. */
export type DemoBoundary = 'same-origin' | 'cross-origin-same-site' | 'cross-site'

/** A link into the repository showing how a demo's integration is built. */
export interface DemoSourceLink {
  /** Short label naming what the link shows. */
  label: string
  /** Absolute GitHub URL of the file or directory. */
  href: string
}

/** One demo album in the gallery. */
export interface DemoManifestEntry {
  /** Stable slug, also the carousel card id. */
  slug: string
  /** Display title. */
  title: string
  /** One-line description shown under the centered card. */
  description: string
  /** Origin boundary the live embed crosses, labeled in the UI. */
  boundary: DemoBoundary
  /** URL the live feature app is served from; absent while the demo is in planning. */
  featureUrl?: string
  /** `true` once the demo's implementation is merged but its live origin has not deployed yet. */
  built?: boolean
  /** Frameworks on each side of the boundary. */
  stack: string
  /** High-value source locations for the demo's host and hostee implementations. */
  sourceLinks?: readonly DemoSourceLink[]
}

/** Root of the repository every source link points into. */
const REPO = 'https://github.com/AndrewRedican/hyperfrontend'

/**
 * Resolves the clock feature's URL: the deployed origin by default, overridable
 * via `NEXT_PUBLIC_CLOCK_FEATURE_URL` — which `.env.development` points at the
 * local `hf dev` server so the full host-to-hostee wiring is testable before a
 * deploy.
 *
 * @returns The URL the clock feature app is embedded from.
 */
function clockFeatureUrl(): string {
  return process.env['NEXT_PUBLIC_CLOCK_FEATURE_URL'] ?? 'https://demo-clock-production.up.railway.app/'
}

/**
 * Resolves the heartbeat feature's URL: the deployed origin by default,
 * overridable via `NEXT_PUBLIC_HEARTBEAT_FEATURE_URL` — which
 * `.env.development` points at the local `hf dev` server so the full
 * host-to-hostee wiring is testable before a deploy.
 *
 * @returns The URL the heartbeat feature app is embedded from.
 */
function heartbeatFeatureUrl(): string {
  return process.env['NEXT_PUBLIC_HEARTBEAT_FEATURE_URL'] ?? 'https://demo-heartbeat-production.up.railway.app/'
}

/** Every demo album, in carousel order — live demos first. */
export const DEMO_MANIFEST: readonly DemoManifestEntry[] = [
  {
    slug: 'clock',
    title: 'Clock',
    description:
      'A luxury timepiece coin — navy sunburst dial on one face, a steel case-back LCD on the other. Spin it: the resting face is the clock’s format, and every flip is contract traffic.',
    boundary: 'cross-site',
    featureUrl: clockFeatureUrl(),
    stack: 'Vue 3 feature · React host',
    sourceLinks: [
      { label: 'Feature app (Vue)', href: `${REPO}/tree/main/apps/demos/clock` },
      { label: 'Contract', href: `${REPO}/blob/main/apps/demos/clock/clock.contract.ts` },
      { label: 'Host embed (React)', href: `${REPO}/blob/main/apps/docs-site/src/components/demos/demo-embed.tsx` },
      { label: 'Host console', href: `${REPO}/blob/main/apps/docs-site/src/components/demos/demo-host-console.tsx` },
    ],
  },
  {
    slug: 'heartbeat',
    title: 'Heartbeat',
    description:
      'An anatomical heart whose every contraction is contract traffic — tap for extra beats, hold to flatline, and watch the host draw the ECG, pop toasts, and materialise a skull.',
    boundary: 'cross-site',
    featureUrl: heartbeatFeatureUrl(),
    stack: 'React 19 feature · vanilla-TS host',
    sourceLinks: [
      { label: 'Feature app (React)', href: `${REPO}/tree/main/apps/demos/heartbeat` },
      { label: 'Contract', href: `${REPO}/blob/main/apps/demos/heartbeat/heartbeat.contract.ts` },
      { label: 'Rhythm engine', href: `${REPO}/blob/main/apps/demos/heartbeat/src/rhythm/rhythm-engine.ts` },
      { label: 'Host page (vanilla TS)', href: `${REPO}/blob/main/apps/demos/heartbeat/src/host/main.ts` },
    ],
  },
  {
    slug: 'chess',
    title: 'Chess',
    description: 'Two boards, one game — competing features negotiating shared state through the host.',
    boundary: 'cross-site',
    stack: 'In planning',
  },
  {
    slug: 'events',
    title: 'Events',
    description: 'A host orchestrating a swarm of event producers and consumers across origins.',
    boundary: 'cross-origin-same-site',
    stack: 'In planning',
  },
  {
    slug: 'file-share',
    title: 'File Share',
    description: 'Moving real payloads across the boundary — chunking, progress, and back-pressure.',
    boundary: 'cross-site',
    stack: 'In planning',
  },
  {
    slug: 'views',
    title: 'Views',
    description: 'One feature, four display modes — embedded, dialog, popup, and standalone.',
    boundary: 'cross-origin-same-site',
    stack: 'In planning',
  },
]

/** Human-readable boundary labels for the gallery UI. */
export const BOUNDARY_LABELS: Record<DemoBoundary, string> = {
  'same-origin': 'same origin',
  'cross-origin-same-site': 'cross-origin, same site',
  'cross-site': 'cross-site',
}
