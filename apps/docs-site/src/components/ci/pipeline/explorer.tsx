'use client'

import type { Execution } from '@/lib/ci/execution'
import type { BrowserQuery } from '@/lib/ci/run-browser'
import type { TaskRef } from './task-detail'
import { DEFAULT_QUERY, newestRun } from '@/lib/ci/run-browser'
import { useCallback, useEffect, useState } from 'react'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { Placeholder } from '../placeholder'
import { MatrixView } from './matrix-view'
import { ProjectView } from './project-view'
import { RefreshStatus } from './refresh-status'
import { RunBrowser } from './run-browser'
import { RunHeader } from './run-header'
import { TaskDetail } from './task-detail'
import { TimelineView } from './timeline-view'
import { useExecution } from './use-execution'
import { useRunList } from './use-run-list'
import { useVisible } from './use-visible'

/** How the selected execution is shown. */
type View = 'timeline' | 'projects' | 'matrix'

/** One view of the execution. */
interface ViewEntry {
  /** The view */
  key: View
  /** Its tab label */
  label: string
  /** What it answers, for a tooltip */
  title: string
}

/** The views, with what each answers. */
const VIEWS: readonly ViewEntry[] = [
  { key: 'timeline', label: 'Timeline', title: 'When each task ran, on which runner, beside what else' },
  { key: 'projects', label: 'Projects', title: 'Each project once, with its chain on every runner' },
  { key: 'matrix', label: 'Matrix', title: 'How the plan spread the work over the runners' },
]

/** The prefix of the run id in the page's fragment. */
const HASH_PREFIX = '#run-'

/**
 * The run id the page's fragment names.
 * @returns The id, or null
 */
function runFromHash(): number | null {
  const hash = window.location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null
  const id = parseInt(hash.slice(HASH_PREFIX.length), 10)
  return id > 0 ? id : null
}

/**
 * The pipeline explorer: every run the records branch and GitHub know in one browser, the
 * selected one, the newest by default, read from its record or followed through its check runs
 * and drawn as a timeline, by project, or as the matrix that spread its work over the runners.
 * @returns The explorer
 */
export function PipelineExplorer() {
  const visible = useVisible()
  const [token, setToken] = useState<string | null>(null)
  const [query, setQuery] = useState<BrowserQuery>(DEFAULT_QUERY)
  const [chosen, setChosen] = useState<number | null>(null)
  const [view, setView] = useState<View>('timeline')
  const [selectedTask, setSelectedTask] = useState<TaskRef | null>(null)
  const [now, setNow] = useState(() => dateNow())
  const onToken = useCallback((next: string | null) => setToken(next), [])
  const list = useRunList(token)

  useEffect(() => {
    const fromHash = runFromHash()
    if (fromHash !== null) setChosen(fromHash)
  }, [])

  const selectedId = chosen ?? newestRun(list.runs)?.id ?? null
  const summary = list.runs.find((run) => run.id === selectedId) ?? null
  const refreshList = list.refresh
  const onRead = useCallback(
    (execution: Execution) => {
      // why: a run that just completed may have pushed its record, and the list is what says so
      if (execution.status === 'completed') refreshList()
    },
    [refreshList]
  )
  const followed = useExecution(summary, summary === null ? null : (list.listed.get(summary.id) ?? null), token, visible, onRead)

  useEffect(() => {
    if (!visible) return
    const timer = setInterval(() => setNow(dateNow()), 1000)
    return () => clearInterval(timer)
  }, [visible])

  useEffect(() => {
    setSelectedTask(null)
  }, [selectedId])

  const select = (id: number) => {
    setChosen(id)
    window.history.replaceState(null, '', `${HASH_PREFIX}${id}`)
  }
  const execution = followed.execution
  const missing = chosen !== null && list.runs.length > 0 && summary === null && list.listPending === null && list.indexPending === null
  return (
    <div className="ci-explorer">
      <RunBrowser
        runs={list.runs}
        selected={selectedId}
        onSelect={select}
        query={query}
        onQuery={setQuery}
        indexPending={list.indexPending}
        listPending={list.listPending}
        now={now}
        onRetry={list.refresh}
      />
      {missing ? (
        <Placeholder
          state="empty"
          motif="pipeline"
          title={`Run ${chosen} is not among the runs this page knows`}
          detail="It may be older than the records kept, or of another workflow."
          onRetry={() => select(newestRun(list.runs)?.id ?? 0)}
        />
      ) : null}
      {summary === null ? null : (
        <>
          <RunHeader summary={summary} execution={execution} now={now} />
          {execution === null ? (
            <Placeholder
              state={followed.pending?.state ?? 'loading'}
              motif="pipeline"
              title={
                followed.pending?.state === 'error'
                  ? `Run #${summary.number} could not be read`
                  : followed.pending?.state === 'empty'
                    ? `Run #${summary.number} has nothing to show yet`
                    : `Reading run #${summary.number}`
              }
              detail={followed.pending?.detail ?? null}
              onRetry={followed.pending?.state === 'error' ? followed.refresh : null}
            />
          ) : (
            <>
              <div role="tablist" aria-label="View" className="mt-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
                {VIEWS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="tab"
                    aria-selected={view === entry.key}
                    title={entry.title}
                    onClick={() => setView(entry.key)}
                    className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                      view === entry.key
                        ? 'border-slate-900 font-medium text-slate-900 dark:border-white dark:text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              {execution.chains.length === 0 ? (
                <Placeholder
                  state={execution.status === 'completed' ? 'empty' : 'loading'}
                  motif="pipeline"
                  title={execution.status === 'completed' ? 'This run published no plan' : 'Waiting for the plan'}
                />
              ) : view === 'timeline' ? (
                <TimelineView execution={execution} selected={selectedTask} onSelect={setSelectedTask} />
              ) : view === 'projects' ? (
                <ProjectView execution={execution} selected={selectedTask} onSelect={setSelectedTask} />
              ) : (
                <MatrixView execution={execution} />
              )}
              {view === 'matrix' ? null : <TaskDetail execution={execution} selected={selectedTask} onSelect={setSelectedTask} />}
            </>
          )}
          <RefreshStatus
            readAt={execution?.readAt ?? null}
            pace={followed.pace}
            recorded={execution?.source === 'record'}
            failure={followed.failure}
            now={now}
            onRefresh={followed.refresh}
            onToken={onToken}
          />
        </>
      )}
    </div>
  )
}
