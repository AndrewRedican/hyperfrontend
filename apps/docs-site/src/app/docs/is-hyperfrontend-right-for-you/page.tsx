import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { Questionnaire } from '@/components/decision/questionnaire'
import { DocsContentWrapper } from '@/components/docs-content-wrapper'
import { H1 } from '@/components/heading-with-anchor'
import { JsonLd } from '@/components/json-ld'
import { ResearchDisclosure } from '@/components/research-disclosure'
import { decisionFramework } from '@/data/decision-framework'
import { getFitAssessmentMetadata } from '@/lib/metadata'
import { SITE_URL } from '@/lib/site'

const ROUTE = '/docs/is-hyperfrontend-right-for-you'

export const metadata: Metadata = getFitAssessmentMetadata(decisionFramework.metadata.lastReviewed)

/**
 * The fit assessment: a short questionnaire that decides whether HyperFrontend
 * suits the reader's constraints, and what does if it does not.
 * @returns The assessment page.
 */
export default function FitAssessmentPage() {
  const { metadata: frameworkMeta } = decisionFramework

  return (
    <DocsContentWrapper>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'HyperFrontend fit assessment',
          url: `${SITE_URL}${ROUTE}/`,
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Requires JavaScript',
          isAccessibleForFree: true,
          dateModified: frameworkMeta.lastReviewed,
          description: metadata.description,
          about: [
            { '@type': 'Thing', name: 'Microfrontend architecture' },
            { '@type': 'Thing', name: 'Frontend composition' },
          ],
          publisher: { '@type': 'Organization', name: 'HyperFrontend', url: SITE_URL },
        }}
      />

      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Is HyperFrontend right for you?</H1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
        Answer a few questions to see if HyperFrontend fits your needs, or find the right alternative.
      </p>

      <ResearchDisclosure
        collapsible
        className="mt-5"
        reviewed={frameworkMeta.researchSnapshot}
        route={ROUTE}
        subject="fit assessment"
        unitCount={frameworkMeta.unitCount}
        attributeCount={frameworkMeta.attributeCount}
      />

      <Questionnaire resultRoute={`${ROUTE}/result`} />
    </DocsContentWrapper>
  )
}
