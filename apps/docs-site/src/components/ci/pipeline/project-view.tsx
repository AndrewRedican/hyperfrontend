'use client'

import type { Execution, StateCounts, TaskState } from '@/lib/ci/execution'
import type { ProjectGroup } from '@/lib/ci/projects'
import type { TaskRef } from './task-detail'
import { formatDuration } from '@/lib/ci/pipeline-view'
import { groupProjects } from '@/lib/ci/projects'
import { CHAIN_STATUS_LABEL, ENVIRONMENT_LABEL, STATE_COLOUR, STATE_LABEL } from '@/lib/ci/vocabulary'
import { useMemo, useState } from 'react'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { InlineIcon } from '../node-icon'
import { ChainGraph } from './chain-graph'
import { ChainMark, ExternalLink, OsIcon } from './marks'

/** Props for {@link ProjectView}. */
export interface ProjectViewProps {
  /** The execution */
  execution: Execution
  /** The selected task, or null */
  selected: TaskRef | null
  /** Selects a task */
  onSelect: (ref: TaskRef) => void
}

/** The states a progress strip shows, ended ones first. */
const STRIP_STATES: readonly TaskState[] = ['success', 'failure', 'skipped', 'cancelled', 'ready', 'blocked', 'queued', 'unknown']

/**
 * The counts of a group in words, for a tooltip and a screen reader.
 * @param counts - The counts
 * @param total - How many tasks
 * @returns `7 tasks: 5 succeeded, 1 failed, 1 skipped`
 */
function wordCounts(counts: StateCounts, total: number): string {
  const parts = STRIP_STATES.filter((state) => counts[state] > 0).map((state) => `${counts[state]} ${STATE_LABEL[state]}`)
  return `${total} task${total === 1 ? '' : 's'}: ${parts.join(', ')}`
}

/** Props for {@link ProgressStrip}. */
interface ProgressStripProps {
  /** The counts */
  counts: StateCounts
  /** How many tasks */
  total: number
}

/**
 * A group's tasks as a strip, one segment per state, in proportion.
 * @param props - See {@link ProgressStripProps}.
 * @param props.counts
 * @param props.total
 * @returns The strip
 */
function ProgressStrip({ counts, total }: ProgressStripProps) {
  return (
    <span
      className="inline-flex h-2 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="img"
      aria-label={wordCounts(counts, total)}
      title={wordCounts(counts, total)}
    >
      {STRIP_STATES.filter((state) => counts[state] > 0).map((state) => (
        <span
          key={state}
          className={`h-full ${state === 'ready' ? 'ci-pulse' : ''}`}
          style={{
            width: `${(counts[state] / total) * 100}%`,
            background: state === 'queued' || state === 'blocked' || state === 'unknown' ? 'transparent' : STATE_COLOUR[state],
            borderRight: '1px solid var(--ci-surface)',
          }}
        />
      ))}
    </span>
  )
}

/** Props for {@link ProjectRow}. */
interface ProjectRowProps {
  /** The project */
  group: ProjectGroup
  /** Whether it is opened */
  open: boolean
  /** Opens or closes it */
  onToggle: () => void
  /** The selected task, or null */
  selected: TaskRef | null
  /** Selects a task */
  onSelect: (ref: TaskRef) => void
}

/**
 * One project: a summary row that opens into its chain on every runner.
 * @param props - See {@link ProjectRowProps}.
 * @param props.group
 * @param props.open
 * @param props.onToggle
 * @param props.selected
 * @param props.onSelect
 * @returns The row
 */
function ProjectRow({ group, open, onToggle, selected, onSelect }: ProjectRowProps) {
  const ended = group.counts.success + group.counts.failure + group.counts.skipped + group.counts.cancelled
  const span = group.startedAt !== null && group.endedAt !== null ? group.endedAt - group.startedAt : null
  return (
    <li className="border-t border-slate-200 first:border-t-0 dark:border-slate-700">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span aria-hidden="true" className="w-3 text-xs text-slate-400">
          {open ? '▾' : '▸'}
        </span>
        <ChainMark status={group.status} of={group.project} size={14} />
        <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-slate-900 dark:text-white" title={group.project}>
          <InlineIcon kind={group.presentation.icon} className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span className="truncate">{group.presentation.label}</span>
        </span>
        <span className="inline-flex gap-1 text-slate-500 dark:text-slate-400">
          {group.lanes.map((lane) => (
            <span
              key={lane.environment}
              className="inline-flex items-center gap-0.5"
              title={`${ENVIRONMENT_LABEL[lane.environment]}: ${CHAIN_STATUS_LABEL[lane.chain.status]}`}
            >
              <OsIcon environment={lane.environment} className="h-3 w-3" />
              <ChainMark status={lane.chain.status} of={`${group.project} on ${ENVIRONMENT_LABEL[lane.environment]}`} size={10} />
            </span>
          ))}
        </span>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {group.attention.length === 0 ? null : (
            <span className="font-medium text-[var(--ci-critical)]">
              {group.attention.length} {group.attention.length === 1 ? 'needs' : 'need'} attention
            </span>
          )}
          <span className="tabular-nums">
            {ended}/{group.total} ended
          </span>
          <ProgressStrip counts={group.counts} total={group.total} />
          <span className="w-14 text-right tabular-nums">{span === null ? '' : formatDuration(span)}</span>
        </span>
      </button>
      {open ? (
        <ul className="space-y-2 px-2 pb-3 pl-8">
          {group.lanes.map((lane) => (
            <li key={lane.environment} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex w-24 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <OsIcon environment={lane.environment} className="h-3.5 w-3.5" named />
                <ChainMark status={lane.chain.status} of={`${group.project} on ${ENVIRONMENT_LABEL[lane.environment]}`} size={12} />
              </span>
              <div className="overflow-x-auto">
                <ChainGraph graph={lane.graph} selected={selected} onSelect={onSelect} />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {lane.chain.startedAt !== null && lane.chain.endedAt !== null
                  ? formatDuration(lane.chain.endedAt - lane.chain.startedAt)
                  : CHAIN_STATUS_LABEL[lane.chain.status]}
                {lane.chain.url === null ? null : (
                  <>
                    {' · '}
                    <ExternalLink href={lane.chain.url}>check run</ExternalLink>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * The run by project: each project once, with its state across every runner and its tasks
 * ended so far, opening into one small graph of its chain per runner.
 * @param props - See {@link ProjectViewProps}.
 * @param props.execution
 * @param props.selected
 * @param props.onSelect
 * @returns The view
 */
export function ProjectView({ execution, selected, onSelect }: ProjectViewProps) {
  const groups = useMemo(() => groupProjects(execution), [execution])
  const [opened, setOpened] = useState<ReadonlySet<string>>(createSet())
  const [attentionOnly, setAttentionOnly] = useState(false)
  const shown = attentionOnly ? groups.filter((group) => group.status !== 'success') : groups
  const toggle = (project: string) =>
    setOpened((current) => {
      const next = createSet(current)
      if (next.has(project)) next.delete(project)
      else next.add(project)
      return next
    })
  return (
    <div className="ci-explorer mt-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{groups.length} projects · in the order the scheduler serves them</span>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />
          only what is not green
        </label>
        <button
          type="button"
          onClick={() => setOpened(opened.size === groups.length ? createSet() : createSet(groups.map((group) => group.project)))}
          className="ml-auto underline-offset-2 hover:underline"
        >
          {opened.size === groups.length ? 'close all' : 'open all'}
        </button>
      </div>
      <ul className="mt-2 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {shown.length === 0 ? <li className="px-2 py-3 text-xs text-slate-500">Every project is green.</li> : null}
        {shown.map((group) => (
          <ProjectRow
            key={group.project}
            group={group}
            open={opened.has(group.project)}
            onToggle={() => toggle(group.project)}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  )
}
