import { Breadcrumb } from '@/components/breadcrumb'
import { GraphExplorer } from '@/components/ci/graph-explorer'
import { H1 } from '@/components/heading-with-anchor'
import { GRAPH_ROUTE, RECORDS_BRANCH } from '@/lib/ci/sources'
import { getPageMetadata } from '@/lib/metadata'
import { REPO_URL } from '@/lib/site'

export const metadata = getPageMetadata({
  title: 'Dependency graph',
  description:
    'The dependency graph the HyperFrontend pipeline runs on: every project, entry point, package and tool of the workspace, with the kind and role of every edge and the files behind it.',
  path: GRAPH_ROUTE,
})

export default function GraphPage() {
  return (
    <>
      <Breadcrumb />
      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Dependency graph</H1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        The workspace owns its dependency analysis: a graph of every file, entry point, installed package, executor and configuration file,
        with each edge qualified by what drew it and by the role of the file that did. The pipeline selects, orders and schedules its work
        from this graph. This page draws the graph the last run on <code className="font-mono text-base">main</code> was built from, read
        from the{' '}
        <a href={`${REPO_URL}/tree/${RECORDS_BRANCH}`} className="text-primary-600 hover:underline dark:text-primary-400">
          {RECORDS_BRANCH}
        </a>{' '}
        branch the workflow writes.
      </p>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        Start with production imports between projects, then switch on type-only imports, the edges spec files draw, the configuration that
        declares a dependency, or the executors a target runs. Narrow the view around one project to see its neighbourhood, and click any
        project or edge for the files behind it, each a link to the source at the recorded commit.
      </p>
      <GraphExplorer />
    </>
  )
}
