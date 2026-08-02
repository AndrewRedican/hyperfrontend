import type { DemoManifestEntry } from '@/lib/demo-manifest'
import { BOUNDARY_LABELS } from '@/lib/demo-manifest'

/** Why the card is standing in for the demo's live surface. */
export type FallbackStatus = 'planned' | 'connecting' | 'offline' | 'idle'

/** Props for {@link DemoFallbackCard}. */
export interface DemoFallbackCardProps {
  /** The demo this card stands in for. */
  entry: DemoManifestEntry
  /** Why the live surface is not showing; defaults to `planned`. */
  status?: FallbackStatus
}

/** The per-demo accent classes, one distinct hue per demo. */
interface DemoTheme {
  /** Card surface gradient and border. */
  surface: string
  /** Icon chip colors. */
  chip: string
  /** Status-pill colors for the demo's own accent. */
  pill: string
  /** Pulsing status-dot color. */
  dot: string
}

/** One theme per demo slug; unknown slugs fall back to slate. */
const THEMES: Record<string, DemoTheme> = {
  clock: {
    surface: 'border-amber-200 from-amber-50 to-amber-100 dark:border-amber-900 dark:from-amber-950 dark:to-slate-950',
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  chess: {
    surface: 'border-violet-200 from-violet-50 to-violet-100 dark:border-violet-900 dark:from-violet-950 dark:to-slate-950',
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  events: {
    surface: 'border-sky-200 from-sky-50 to-sky-100 dark:border-sky-900 dark:from-sky-950 dark:to-slate-950',
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400',
    pill: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  'file-share': {
    surface: 'border-emerald-200 from-emerald-50 to-emerald-100 dark:border-emerald-900 dark:from-emerald-950 dark:to-slate-950',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  heartbeat: {
    surface: 'border-red-200 from-red-50 to-red-100 dark:border-red-900 dark:from-red-950 dark:to-slate-950',
    chip: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
    pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
  },
  views: {
    surface: 'border-indigo-200 from-indigo-50 to-indigo-100 dark:border-indigo-900 dark:from-indigo-950 dark:to-slate-950',
    chip: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400',
    pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
}

/** Slate fallback theme for slugs without a dedicated entry. */
const DEFAULT_THEME: DemoTheme = {
  surface: 'border-slate-200 from-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900',
  chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  dot: 'bg-slate-400',
}

/** Status-pill copy per fallback status. */
const STATUS_LABELS: Record<FallbackStatus, string> = {
  planned: 'In planning',
  connecting: 'Connecting…',
  offline: 'Warming up on its own origin',
  idle: 'Live demo',
}

/** Corner-label copy per fallback status. */
const CORNER_LABELS: Record<FallbackStatus, string> = {
  planned: 'shipping soon',
  connecting: 'live demo',
  offline: 'live demo',
  idle: 'center to activate',
}

/** Outline icon paths per demo, 24×24 viewBox. */
const ICON_PATHS: Record<string, string> = {
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  chess:
    'M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z',
  events:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  'file-share':
    'M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15',
  heartbeat:
    'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  views:
    'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
}

/** Generic sparkle icon for slugs without a dedicated glyph. */
const FALLBACK_ICON_PATH =
  'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z'

/**
 * The one fallback surface every demo shares — shown while a demo is in
 * planning, while a live demo is connecting or offline, and on a live demo's
 * non-centered gallery card.
 *
 * Always fills its parent (`h-full w-full`), so the parent owns the aspect
 * ratio. Each demo carries its own accent hue over the shared structure, the
 * card sits at 80% opacity so the page shows through, and only the status
 * pill and corner label change between states.
 * @param root0
 * @param root0.entry
 * @param root0.status
 */
export function DemoFallbackCard({ entry, status = 'planned' }: DemoFallbackCardProps) {
  const theme = THEMES[entry.slug] ?? DEFAULT_THEME
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-2xl border bg-gradient-to-br opacity-80 ${theme.surface}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] bg-[length:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)]" />
      <span className="absolute right-4 top-3 font-mono text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {CORNER_LABELS[status]}
      </span>
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className={`inline-flex rounded-lg p-2.5 ${theme.chip}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[entry.slug] ?? FALLBACK_ICON_PATH} />
          </svg>
        </span>
        <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">{entry.title}</h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${theme.pill}`}>
            {status === 'planned' || status === 'connecting' ? (
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full motion-safe:animate-pulse ${theme.dot}`} />
            ) : null}
            {STATUS_LABELS[status]}
          </span>
          <span className="rounded-full bg-white/60 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            {BOUNDARY_LABELS[entry.boundary]}
          </span>
        </div>
      </div>
    </div>
  )
}
