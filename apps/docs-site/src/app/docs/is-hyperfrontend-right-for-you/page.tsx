import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { Questionnaire } from '@/components/decision/questionnaire'
import { DocsContentWrapper } from '@/components/docs-content-wrapper'
import { H1 } from '@/components/heading-with-anchor'
import { ResearchDisclosure } from '@/components/research-disclosure'
import { decisionFramework } from '@/data/decision-framework'

const ROUTE = '/docs/is-hyperfrontend-right-for-you'

export const metadata: Metadata = {
  title: 'Is HyperFrontend right for you?',
  description:
    'Answer a few questions about your systems and teams to find out whether HyperFrontend fits, and which microfrontend approach fits better if it does not.',
  alternates: { canonical: `${ROUTE}/` },
}

/**
 * The fit assessment: a short questionnaire that decides whether HyperFrontend
 * suits the reader's constraints, and what does if it does not.
 * @returns The assessment page.
 */
export default function FitAssessmentPage() {
  const { metadata: frameworkMeta } = decisionFramework

  return (
    <DocsContentWrapper>
      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Is HyperFrontend right for you?</H1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
        Answer a few questions about your systems and teams to find out whether HyperFrontend suits your situation. If it does not, you will
        see which class of microfrontend solution matches your requirements better, and exactly what would have to change for HyperFrontend
        to become viable.
      </p>

      <Questionnaire resultRoute={`${ROUTE}/result`} />

      <div className="mt-8">
        <ResearchDisclosure
          reviewed={frameworkMeta.researchSnapshot}
          route={ROUTE}
          subject="fit assessment"
          unitCount={frameworkMeta.unitCount}
          attributeCount={frameworkMeta.attributeCount}
        />
      </div>
    </DocsContentWrapper>
  )
}
