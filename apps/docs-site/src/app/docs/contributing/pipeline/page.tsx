import { Breadcrumb } from '@/components/breadcrumb'
import { PipelineExplorer } from '@/components/ci/pipeline-explorer'
import { H1 } from '@/components/heading-with-anchor'
import { PIPELINE_ROUTE, RECORDS_BRANCH } from '@/lib/ci/sources'
import { getPageMetadata } from '@/lib/metadata'
import { REPO_URL } from '@/lib/site'

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
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        A pull request or a push to <code className="font-mono text-base">main</code> runs exactly the tasks the change reaches, planned
        from the dependency graph and executed by a scheduler on a Linux and a Windows runner. Each run of{' '}
        <code className="font-mono text-base">main</code> leaves its plan and results on the{' '}
        <a href={`${REPO_URL}/tree/${RECORDS_BRANCH}`} className="text-primary-600 hover:underline dark:text-primary-400">
          {RECORDS_BRANCH}
        </a>{' '}
        branch; a run in progress publishes its plan and every chain&apos;s progress as check runs on its commit.
      </p>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        A recorded run shows every chain as a row and every task as a bar on the run&apos;s clock, coloured by outcome; click a task to read
        why it was in the plan, and unfold the skipped tasks to see the rule that made each skip safe. A live run shows the same chains as
        they are reached, read from GitHub without a token at this page&apos;s own pace.
      </p>
      <PipelineExplorer />
    </>
  )
}
