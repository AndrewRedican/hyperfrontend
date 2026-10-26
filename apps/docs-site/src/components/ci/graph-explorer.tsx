'use client'

import type { CanvasEdge, CanvasGraph, GraphFilters, ResourceKind } from '@/lib/ci/graph-view'
import type { EdgeKind, ExplorerDocument, ExplorerLink, ExplorerProject, Role } from '@/lib/ci/model'
import type { Status } from './status-line'
import { fetchJson } from '@/lib/ci/fetch'
import {
  ALL_KINDS,
  ALL_ROLES,
  CONFIGURATION_KINDS,
  DEFAULT_FILTERS,
  IMPORT_KINDS,
  buildCanvas,
  familyOf,
  labelOf,
  targetKind,
  targetResolver,
} from '@/lib/ci/graph-view'
import { formatWhen, shortSha } from '@/lib/ci/pipeline-view'
import { RECORDS_URL, sourceUrl } from '@/lib/ci/sources'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { ConnectionView } from './connection-view'
import { FAMILY_COLOUR, GraphCanvas, KIND_DASH } from './graph-canvas'
import { StatusLine, Toggle } from './status-line'

/** The selected project's node id, or nothing. */
type Selection = string | null

/**
 * A set with one member flipped.
 * @param set - The set
 * @param member - The member
 * @returns A new set
 */
function flipped<Member>(set: ReadonlySet<Member>, member: Member): Set<Member> {
  const next = createSet(set)
  if (next.has(member)) next.delete(member)
  else next.add(member)
  return next
}

/**
 * The dependency explorer: the workspace graph the pipeline was built from, drawn from the
 * explorer document the main workflow records, with the edge kinds, roles, resources and
 * project types a reader switches on, a project to narrow the view around, and a panel
 * naming every file behind what is selected.
 * @returns The explorer
 */
export function GraphExplorer() {
  const [document, setDocument] = useState<ExplorerDocument | null>(null)
  const [status, setStatus] = useState<Status>({ message: 'Loading the graph…', error: false })
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS)
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<Selection>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchJson<ExplorerDocument>(`${RECORDS_URL}/graph/latest.json`, { signal: controller.signal })
      .then(({ value }) => {
        if (value.schema !== 1) throw createError('the graph document has a schema this page does not read')
        setDocument(value)
        setStatus({ message: null, error: false })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({
          message: `The graph could not be loaded: ${error instanceof Error ? error.message : String(error)}. The main workflow writes it to the ${'ci-records'} branch after each run.`,
          error: true,
        })
      })
    return () => controller.abort()
  }, [])

  const canvas: CanvasGraph | null = useMemo(() => (document === null ? null : buildCanvas(document, filters)), [document, filters])
  const matched = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '' || canvas === null) return createSet<string>()
    return createSet(
      canvas.nodes
        .filter((node) => node.label.toLowerCase().includes(needle) || node.name.toLowerCase().includes(needle))
        .map((node) => node.id)
    )
  }, [canvas, query])

  const [opened, setOpened] = useState<CanvasEdge | null>(null)
  const closeConnection = useCallback(() => setOpened(null), [])
  const onSelect = (id: string | null) => setSelection(id)
  const openedEnds =
    opened === null || canvas === null
      ? null
      : { source: canvas.nodes.find((node) => node.id === opened.source), target: canvas.nodes.find((node) => node.id === opened.target) }

  return (
    <div className="ci-explorer">
      {document === null ? null : (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          {document.projects.length} projects, {document.entries.length} entries, {document.links.length} folded links from the graph built
          at commit <code className="font-mono text-xs">{shortSha(document.sha)}</code> on {formatWhen(document.generatedAt)}.
          {canvas === null ? '' : ` Drawing ${canvas.nodes.length} nodes and ${canvas.edges.length} edges.`}
        </p>
      )}
      <StatusLine message={status.message} error={status.error} />

      {document === null || canvas === null ? null : (
        <>
          <Toolbar document={document} filters={filters} onFilters={setFilters} query={query} onQuery={setQuery} />
          <GraphCanvas
            graph={canvas}
            selected={selection}
            matched={matched}
            focus={filters.focus === null ? null : `project:${filters.focus}`}
            onSelect={onSelect}
            onOpenEdge={setOpened}
          />
          <Legend />
          {opened === null || openedEnds?.source === undefined || openedEnds.target === undefined ? null : (
            <ConnectionView
              edge={opened}
              source={openedEnds.source}
              target={openedEnds.target}
              sha={document.sha}
              onClose={closeConnection}
            />
          )}
          <DetailPanel document={document} selection={selection} onSelect={onSelect} />
        </>
      )}
    </div>
  )
}

/** Props for {@link Toolbar}. */
interface ToolbarProps {
  /** The document */
  document: ExplorerDocument
  /** The filters */
  filters: GraphFilters
  /** Replaces the filters */
  onFilters: (filters: GraphFilters) => void
  /** The search text */
  query: string
  /** Replaces the search text */
  onQuery: (query: string) => void
}

/**
 * The toggles above the canvas: edge kinds by family, roles, resources, project types, the
 * focused project and the search.
 * @param props - See {@link ToolbarProps}.
 * @param props.document
 * @param props.filters
 * @param props.onFilters
 * @param props.query
 * @param props.onQuery
 * @returns The toolbar
 */
function Toolbar({ document, filters, onFilters, query, onQuery }: ToolbarProps) {
  const kindChips = (kinds: readonly EdgeKind[]) =>
    kinds.map((kind) => (
      <Toggle
        key={kind}
        label={kind}
        on={filters.kinds.has(kind)}
        onToggle={() => onFilters({ ...filters, kinds: flipped(filters.kinds, kind) })}
        swatch={FAMILY_COLOUR[familyOf(kind)]}
        dash={KIND_DASH[kind]}
      />
    ))
  const row = 'mt-2 flex flex-wrap items-center gap-1.5'
  const label = 'mr-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
      <div className={row}>
        <span className={label}>Imports</span>
        {kindChips(IMPORT_KINDS)}
        {kindChips(['unresolved'])}
      </div>
      <div className={row}>
        <span className={label}>Declared</span>
        {kindChips(CONFIGURATION_KINDS)}
        {kindChips(['tool'])}
      </div>
      <div className={row}>
        <span className={label}>From files that are</span>
        {ALL_ROLES.map((role: Role) => (
          <Toggle
            key={role}
            label={role}
            on={filters.roles.has(role)}
            onToggle={() => onFilters({ ...filters, roles: flipped(filters.roles, role) })}
          />
        ))}
      </div>
      <div className={row}>
        <span className={label}>Also draw</span>
        {(['external', 'tool', 'config'] as ResourceKind[]).map((resource) => (
          <Toggle
            key={resource}
            label={resource === 'external' ? 'npm packages' : resource === 'tool' ? 'executors' : 'configuration files'}
            on={filters.resources.has(resource)}
            onToggle={() => onFilters({ ...filters, resources: flipped(filters.resources, resource) })}
          />
        ))}
        <span className={`${label} ml-3`}>Projects</span>
        {(['lib', 'app', 'e2e'] as ExplorerProject['type'][]).map((type) => (
          <Toggle
            key={type}
            label={type}
            on={filters.types.has(type)}
            onToggle={() => onFilters({ ...filters, types: flipped(filters.types, type) })}
          />
        ))}
      </div>
      <div className={row}>
        <label className={label} htmlFor="ci-graph-focus">
          Around
        </label>
        <select
          id="ci-graph-focus"
          value={filters.focus ?? ''}
          onChange={(event) => onFilters({ ...filters, focus: event.target.value === '' ? null : event.target.value })}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        >
          <option value="">every project</option>
          {document.projects.map((project) => (
            <option key={project.name} value={project.name}>
              {project.name}
            </option>
          ))}
        </select>
        {filters.focus === null ? null : (
          <>
            <span className={label}>within</span>
            {[1, 2, 3].map((hops) => (
              <Toggle
                key={hops}
                label={`${hops} hop${hops === 1 ? '' : 's'}`}
                on={filters.hops === hops}
                onToggle={() => onFilters({ ...filters, hops })}
              />
            ))}
          </>
        )}
        <label className={`${label} ml-3`} htmlFor="ci-graph-search">
          Find
        </label>
        <input
          id="ci-graph-search"
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="project or package"
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => {
            onFilters(DEFAULT_FILTERS)
            onQuery('')
          }}
          className="ml-auto text-xs text-primary-600 hover:underline dark:text-primary-400"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

/**
 * What the colours and dashes mean.
 * @returns The legend
 */
function Legend() {
  const families: [string, string][] = [
    ['imports', FAMILY_COLOUR.import],
    ['declared in configuration', FAMILY_COLOUR.configuration],
    ['executors a target runs', FAMILY_COLOUR.tool],
    ['unresolved loads', FAMILY_COLOUR.unresolved],
  ]
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
      {families.map(([name, colour]) => (
        <span key={name} className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="18" height="6">
            <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" stroke={colour} />
          </svg>
          {name}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <svg aria-hidden="true" width="18" height="6">
          <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" stroke="var(--ci-ink-2)" strokeDasharray="6 4" />
        </svg>
        dashed: type-only · dash-dot: dynamic · dotted: side-effect · long dash: re-export
      </span>
      <span>
        Each circle counts a line&apos;s contact points, and the words beneath it read from the project in question: the centre of a focused
        view, or the box you point at or select. The overview nests each project around the dependency it leans on most, foundations at the
        centres, and draws that line; a project&apos;s other dependencies appear when you point at it or select it. Around a project, its
        dependencies sit left and its dependents right, one ring per hop.
      </span>
    </div>
  )
}

/** Props for {@link DetailPanel}. */
interface DetailPanelProps {
  /** The document */
  document: ExplorerDocument
  /** What is selected */
  selection: Selection
  /** Selects something else */
  onSelect: (id: string | null) => void
}

/**
 * Everything known about the selection: a project's dependencies and dependants with the kinds,
 * roles and files behind each, or an edge's links file by file, each line a link to the source.
 * @param props - See {@link DetailPanelProps}.
 * @param props.document
 * @param props.selection
 * @param props.onSelect
 * @returns The panel
 */
function DetailPanel({ document, selection, onSelect }: DetailPanelProps) {
  if (selection === null)
    return (
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Click a project to see what it depends on and what depends on it, or a line to see its contact points.
      </p>
    )
  const resolve = targetResolver(document)
  const name = labelOf(selection)
  const project = targetKind(selection) === 'project' ? document.projects.find((candidate) => candidate.name === name) : undefined
  const outgoing = document.links.filter((link) => `project:${link.source}` === selection)
  const incoming = document.links.filter((link) => resolve(link.target) === selection)
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="font-mono font-semibold text-slate-900 dark:text-white">{name}</h3>
      {project === undefined ? (
        <p className="mt-1 text-slate-600 dark:text-slate-400">{targetKind(selection)}</p>
      ) : (
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {project.type} at <code className="font-mono text-xs">{project.root}</code> · {project.files} files
          {project.tags.length === 0 ? '' : ` · ${project.tags.join(', ')}`}
          {project.implicitDependencies.length === 0 ? '' : ` · declares ${project.implicitDependencies.join(', ')}`}
        </p>
      )}
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Depends on ({groupTargets(outgoing, resolve).length})
          </h4>
          <GroupList document={document} links={outgoing} by="target" resolve={resolve} onSelect={onSelect} />
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Depended on by ({groupTargets(incoming, () => '').length})
          </h4>
          <GroupList document={document} links={incoming} by="source" resolve={resolve} onSelect={onSelect} />
        </div>
      </div>
    </section>
  )
}

/**
 * The distinct other ends of some links.
 * @param links - The links
 * @param resolve - Resolves a target to the node it is drawn as
 * @returns The distinct ends
 */
function groupTargets(links: readonly ExplorerLink[], resolve: (target: string) => string): string[] {
  return [...createSet(links.map((link) => (resolve(link.target) === '' ? link.source : resolve(link.target))))]
}

/** Props for {@link GroupList}. */
interface GroupListProps {
  /** The document */
  document: ExplorerDocument
  /** The links */
  links: readonly ExplorerLink[]
  /** Whether to group by the target or the source */
  by: 'target' | 'source'
  /** Resolves a target to the node it is drawn as */
  resolve: (target: string) => string
  /** Selects a node */
  onSelect: (id: string) => void
}

/**
 * Links grouped by their other end, each group naming its kinds and roles and unfolding to its files.
 * @param props - See {@link GroupListProps}.
 * @param props.document
 * @param props.links
 * @param props.by
 * @param props.resolve
 * @param props.onSelect
 * @returns The list
 */
function GroupList({ document, links, by, resolve, onSelect }: GroupListProps) {
  const groups = createMap<string, ExplorerLink[]>()
  for (const link of links) {
    const key = by === 'target' ? resolve(link.target) : `project:${link.source}`
    groups.set(key, [...(groups.get(key) ?? []), link])
  }
  if (groups.size === 0) return <p className="mt-1 text-slate-500 dark:text-slate-400">nothing</p>
  return (
    <ul className="mt-1 space-y-1">
      {[...groups]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, members]) => {
          const files = members.reduce((count, link) => count + link.files.length, 0)
          const kinds = [...createSet(members.map((link) => link.kind))]
          const roles = [...createSet(members.map((link) => link.role))]
          return (
            <li key={id}>
              <details>
                <summary className="cursor-pointer">
                  <button
                    type="button"
                    className="font-mono text-slate-900 hover:underline dark:text-white"
                    onClick={(event) => {
                      event.preventDefault()
                      onSelect(id)
                    }}
                  >
                    {labelOf(id)}
                  </button>{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    {ALL_KINDS.filter((kind) => kinds.includes(kind)).join(', ')} · {roles.join(', ')} · {files} file
                    {files === 1 ? '' : 's'}
                  </span>
                </summary>
                <LinkList document={document} links={members} />
              </details>
            </li>
          )
        })}
    </ul>
  )
}

/** Props for {@link LinkList}. */
interface LinkListProps {
  /** The document */
  document: ExplorerDocument
  /** The links */
  links: readonly ExplorerLink[]
}

/**
 * Links file by file: the kind and role, then each file with its line as a link to the source at the recorded commit.
 * @param props - See {@link LinkListProps}.
 * @param props.document
 * @param props.links
 * @returns The list
 */
function LinkList({ document, links }: LinkListProps) {
  return (
    <ul className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-700">
      {links.map((link) => (
        <li key={`${link.target}|${link.kind}|${link.role}`}>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {link.kind} · {link.role} · <span className="font-mono">{labelOf(link.target)}</span>
          </span>
          <ul className="mt-0.5">
            {link.files.map((file) => (
              <li key={`${file.file}:${file.line ?? ''}`} className="font-mono text-xs">
                <a
                  href={sourceUrl(document.sha, file.file, file.line)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline dark:text-primary-400"
                >
                  {file.file}
                  {file.line === null ? '' : `:${file.line}`}
                </a>
                {file.specifier === null ? '' : <span className="text-slate-500 dark:text-slate-400"> imports {file.specifier}</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
