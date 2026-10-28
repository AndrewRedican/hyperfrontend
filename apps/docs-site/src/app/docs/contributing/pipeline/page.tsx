import { Breadcrumb } from '@/components/breadcrumb'
import { PipelineExplorer } from '@/components/ci/pipeline-explorer'
import { H1 } from '@/components/heading-with-anchor'
import { PIPELINE_ROUTE } from '@/lib/ci/sources'
import { getPageMetadata } from '@/lib/metadata'

export const metadata = getPageMetadata({
  title: 'Pipeline',
  description:
    'Every run of the HyperFrontend pipeline: the tasks a change reached, why each ran or was skipped, the order and timing of their execution on Linux and Windows, and the runs in progress.',
  path: PIPELINE_ROUTE,
})

export default function PipelinePage() {
  return (
    <>
      <Breadcrumb />
      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Pipeline</H1>
      <PipelineExplorer />
    </>
  )
}
