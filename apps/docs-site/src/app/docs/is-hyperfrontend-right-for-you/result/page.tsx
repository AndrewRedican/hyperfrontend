import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { ResultView } from '@/components/decision/result-view'
import { DocsContentWrapper } from '@/components/docs-content-wrapper'

const ASSESSMENT_ROUTE = '/docs/is-hyperfrontend-right-for-you'

export const metadata: Metadata = {
  title: 'Your fit assessment',
  description: 'The architectural decision record generated from your answers, held only in your browser.',
  alternates: { canonical: `${ASSESSMENT_ROUTE}/result/` },
  robots: { index: false, follow: true },
}

/**
 * Renders the decision record for an assessment held in the reader's browser.
 *
 * @returns The result page.
 */
export default function FitAssessmentResultPage() {
  return (
    <DocsContentWrapper>
      <div className="print:hidden">
        <Breadcrumb />
      </div>
      <ResultView assessmentRoute={ASSESSMENT_ROUTE} />
    </DocsContentWrapper>
  )
}
