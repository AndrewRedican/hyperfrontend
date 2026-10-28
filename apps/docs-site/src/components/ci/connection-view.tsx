'use client'

import type { CanvasEdge, CanvasNode } from '@/lib/ci/graph-view'
import type { EdgeKind, ExplorerFile, Role } from '@/lib/ci/model'
import { presentNode } from '@/lib/ci/labels'
import { sourceUrl } from '@/lib/ci/sources'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { InlineIcon, NodeIcon } from './node-icon'

/** Props for {@link ConnectionView}. */
export interface ConnectionViewProps {
  /** The line opened */
  edge: CanvasEdge
  /** The depending box */
  source: CanvasNode
  /** The depended-on box */
  target: CanvasNode
  /** The commit the graph was built from, for the links to the source */
  sha: string
  /** Closes the view */
  onClose: () => void
}

/** One contact point: a line of a file of the depending project. */
interface ContactRow {
  /** The file and the line */
  file: ExplorerFile
  /** What drew it */
  kind: EdgeKind
  /** The file's role */
  role: Role
  /** The entry point or node it reaches */
  target: string
  /** Its middle, in the diagram */
  y: number
}

/** One entry point the contact points reach. */
interface EntryRow {
  /** The node id */
  id: string
  /** What it is called */
  label: string
  /** Its middle, in the diagram */
  y: number
}

/** The two columns of the diagram and its height. */
interface ConnectionLayout {
  /** The contact points, top first */
  contacts: ContactRow[]
  /** The entry points, top first */
  entries: EntryRow[]
  /** The diagram's height */
  height: number
}

/** The height of one row. */
const ROW = 30

/** The width of the contact column. */
const LEFT_WIDTH = 400

/** Where the entry column starts. */
const RIGHT_X = 560

/** The width of the entry column. */
const RIGHT_WIDTH = 320

/**
 * The longest directory prefix the files share.
 * @param files - The paths
 * @returns The prefix, ending in a slash, or an empty string
 */
function commonDirectory(files: readonly string[]): string {
  const [first] = files
  if (first === undefined) return ''
  let prefix = first.slice(0, first.lastIndexOf('/') + 1)
  for (const file of files)
    while (prefix !== '' && !file.startsWith(prefix)) prefix = prefix.slice(0, prefix.slice(0, -1).lastIndexOf('/') + 1)
  return prefix
}

/**
 * The name an entry point or node is shown by.
 * @param id - `entry:<package>/<subpath>`, `project:<name>` or another node id
 * @returns The package subpath for an entry, the presented name otherwise
 */
function entryLabel(id: string): string {
  return id.startsWith('entry:') ? id.slice('entry:'.length) : presentNode(id).label
}

/**
 * Lays the rows out: the contact points in file order down the left, each entry point on the
 * right as near the middle of the contact points reaching it as the entries above it allow.
 * @param edge - The line
 * @returns The rows of both columns and the diagram's height
 */
function layout(edge: CanvasEdge): ConnectionLayout {
  const contacts: ContactRow[] = edge.links
    .flatMap((link) => link.files.map((file) => ({ file, kind: link.kind, role: link.role, target: link.target, y: 0 })))
    .sort((left, right) => left.file.file.localeCompare(right.file.file) || (left.file.line ?? 0) - (right.file.line ?? 0))
  contacts.forEach((row, index) => (row.y = index * ROW + ROW / 2))
  const reaching = createMap<string, number[]>()
  for (const row of contacts) reaching.set(row.target, [...(reaching.get(row.target) ?? []), row.y])
  const entries = [...reaching]
    .map(([id, ys]) => ({ id, label: entryLabel(id), y: ys.reduce((sum, y) => sum + y, 0) / ys.length }))
    .sort((left, right) => left.y - right.y)
  let floor = ROW / 2
  for (const entry of entries) {
    entry.y = max(entry.y, floor)
    floor = entry.y + ROW
  }
  const last = entries[entries.length - 1]
  return { contacts, entries, height: max(contacts.length * ROW, last === undefined ? 0 : last.y + ROW / 2) }
}

/**
 * The contact points of one line, opened as a dialog: every file and line of the depending
 * project that draws it on the left, each joined to the entry point of the depended-on project
 * it reaches on the right, each file a link to its source at the recorded commit.
 * @param props - See {@link ConnectionViewProps}.
 * @param props.edge - The line
 * @param props.source - The depending box
 * @param props.target - The depended-on box
 * @param props.sha - The recorded commit
 * @param props.onClose - Closes the dialog
 * @returns The dialog, in a portal
 */
export function ConnectionView({ edge, source, target, sha, onClose }: ConnectionViewProps) {
  const [mounted, setMounted] = useState(false)
  const close = useRef<HTMLButtonElement | null>(null)
  const { contacts, entries, height } = useMemo(() => layout(edge), [edge])
  const prefix = useMemo(() => commonDirectory(contacts.map((row) => row.file.file)), [contacts])
  const entryY = useMemo(() => createMap(entries.map((entry) => [entry.id, entry.y] as const)), [entries])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, mounted])

  if (!mounted) return null
  const width = RIGHT_X + RIGHT_WIDTH
  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`${source.name} depends on ${target.name}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="ci-explorer flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-start gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-slate-900 dark:text-white">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <InlineIcon kind={source.icon} className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                {source.label}
              </span>
              <span className="font-normal text-slate-600 dark:text-slate-400">depends on</span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <InlineIcon kind={target.icon} className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                {target.label}
              </span>
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {edge.files} contact point{edge.files === 1 ? '' : 's'} · {edge.kinds.join(', ')} · from {edge.roles.join(', ')} files
              {prefix === '' ? (
                ''
              ) : (
                <>
                  {' '}
                  · under <code className="font-mono text-xs">{prefix}</code>
                </>
              )}
            </p>
          </div>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="overflow-auto p-4">
          <div
            className="mb-2 flex justify-between text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
            style={{ width }}
          >
            <span>Contact points in {source.label}</span>
            <span style={{ width: RIGHT_WIDTH }}>Entry points of {target.label}</span>
          </div>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${contacts.length} contact points reaching ${entries.length} entry points`}
          >
            {contacts.map((row) => {
              const ey = entryY.get(row.target) ?? row.y
              return (
                <path
                  key={`line ${row.file.file}:${row.file.line ?? ''}:${row.target}`}
                  d={`M ${LEFT_WIDTH} ${row.y} C ${LEFT_WIDTH + 70} ${row.y}, ${RIGHT_X - 70} ${ey}, ${RIGHT_X} ${ey}`}
                  fill="none"
                  stroke="var(--ci-series-1)"
                  strokeWidth="1.25"
                  opacity="0.7"
                />
              )
            })}
            {contacts.map((row) => (
              <a
                key={`file ${row.file.file}:${row.file.line ?? ''}:${row.target}`}
                href={sourceUrl(sha, row.file.file, row.file.line)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <rect x="0" y={row.y - 12} width={LEFT_WIDTH} height="24" rx="5" fill="var(--ci-node)" stroke="var(--ci-line)" />
                <text x="10" y={row.y} dominantBaseline="central" fontSize="12" fontFamily="var(--font-mono)" fill="var(--ci-ink)">
                  {row.file.file.slice(prefix.length)}
                  {row.file.line === null ? '' : `:${row.file.line}`}
                </text>
                <text x={LEFT_WIDTH - 10} y={row.y} textAnchor="end" dominantBaseline="central" fontSize="10" fill="var(--ci-ink-2)">
                  {row.kind} · {row.role}
                </text>
                <title>{`${row.file.file}${row.file.line === null ? '' : `:${row.file.line}`}${row.file.specifier === null ? '' : ` imports ${row.file.specifier}`}: open the source`}</title>
              </a>
            ))}
            {entries.map((entry) => (
              <g key={entry.id} transform={`translate(${RIGHT_X} ${entry.y - 12})`}>
                <rect width={RIGHT_WIDTH} height="24" rx="5" fill="var(--ci-node)" stroke="var(--ci-series-1)" />
                <NodeIcon kind={target.icon} x={10} y={5} size={14} />
                <text x="30" y="12" dominantBaseline="central" fontSize="12" fontFamily="var(--font-mono)" fill="var(--ci-ink)">
                  {entry.label}
                </text>
                <title>{entry.id}</title>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>,
    document.body
  )
}
