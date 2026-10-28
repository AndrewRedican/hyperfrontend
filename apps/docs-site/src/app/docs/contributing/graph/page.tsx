import { Breadcrumb } from '@/components/breadcrumb'
import { GraphExplorer } from '@/components/ci/graph-explorer'
import { H1 } from '@/components/heading-with-anchor'
import { GRAPH_ROUTE } from '@/lib/ci/sources'
import { getPageMetadata } from '@/lib/metadata'

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
      <GraphExplorer />
    </>
  )
}
