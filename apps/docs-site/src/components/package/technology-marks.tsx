import type { EnvironmentId } from '@/lib/package-facts'
import type { ReactNode } from 'react'

/** Props shared by every runtime mark. */
interface MarkProps {
  /** Sizing and colour classes */
  className?: string
}

/**
 * How one runtime is named and drawn in a compatibility row.
 */
export interface EnvironmentPresentation {
  /** What the runtime is called */
  label: string
  /** Its mark */
  Mark: (props: MarkProps) => ReactNode
}

/**
 * The runtimes a package can claim, with the marks that stand for them.
 *
 * Node.js is a real technology with a real mark, so it gets its own hexagon
 * rather than a generic silhouette. The other two deliberately do not: the
 * repository's compatibility declarations say "browser" and "web worker", not
 * "Chrome 120" or "Safari", and putting a vendor's logo beside a claim the
 * package never made would promise a guarantee nobody tested. A neutral globe
 * and a pair of contexts say exactly as much as the declaration does.
 */
export const ENVIRONMENT_PRESENTATION: Record<EnvironmentId, EnvironmentPresentation> = {
  node: { label: 'Node.js', Mark: NodeMark },
  browser: { label: 'Browsers', Mark: BrowserMark },
  webWorker: { label: 'Web Workers', Mark: WorkerMark },
}

/**
 * The Node.js hexagon, monochrome and unfilled, used nominatively beside the
 * word "Node.js" to say which runtime a package supports.
 *
 * The silhouette alone, at the size a chip gives it, is the part of the mark
 * that survives; the interior detail of the full logo turns to noise at
 * sixteen pixels and would be a worse likeness than none.
 * @param props - See {@link MarkProps}.
 * @param props.className - Sizing and colour classes
 * @returns The mark.
 */
function NodeMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 4.2 26.2 10v12L16 27.8 5.8 22V10z" />
    </svg>
  )
}

/**
 * A globe: the web as a whole, with no browser named.
 * @param props - See {@link MarkProps}.
 * @param props.className - Sizing and colour classes
 * @returns The mark.
 */
function BrowserMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="11.5" />
      <path d="M4.5 16h23" />
      <path d="M16 4.5c3.2 3.1 5 7.2 5 11.5s-1.8 8.4-5 11.5c-3.2-3.1-5-7.2-5-11.5s1.8-8.4 5-11.5z" />
    </svg>
  )
}

/**
 * Two execution contexts side by side: the page's, and the one work is handed
 * to.
 * @param props - See {@link MarkProps}.
 * @param props.className - Sizing and colour classes
 * @returns The mark.
 */
function WorkerMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="8.5" width="14" height="15" rx="3" />
      <rect x="13.5" y="8.5" width="14" height="15" rx="3" />
    </svg>
  )
}
