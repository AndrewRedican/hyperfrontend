import { Breadcrumb } from '@/components/breadcrumb'
import { PipelineExplorer } from '@/components/ci/pipeline/explorer'
import { H1 } from '@/components/heading-with-anchor'
import { PIPELINE_ROUTE } from '@/lib/ci/sources'
import { getPageMetadata } from '@/lib/metadata'

export const metadata = getPageMetadata({
  title: 'Pipeline',
  description:
    'Every run of the HyperFrontend pipeline, recorded or in progress: what ran on Linux, Windows and macOS, when, beside what else, and how the plan spread the work over the runners.',
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
