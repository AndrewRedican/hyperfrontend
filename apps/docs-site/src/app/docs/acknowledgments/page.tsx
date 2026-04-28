import type { Contributor } from '@/lib/docs-loader'
import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { ReadmeContent } from '@/components/readme-content'
import { getAcknowledgments, getContributors } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'

export const metadata: Metadata = {
  title: 'Acknowledgments',
  description: 'Credits and gratitude to supporters, contributors, and sources of inspiration for hyperfrontend.',
}

/** Display metadata (icon + label) for a contribution type */
type ContributionEmoji = {
  emoji: string
  label: string
}

/** Map contribution types to emoji and label */
const CONTRIBUTION_EMOJI: Record<string, ContributionEmoji> = {
  code: { emoji: '💻', label: 'Code' },
  doc: { emoji: '📖', label: 'Documentation' },
  infra: { emoji: '🚇', label: 'Infrastructure' },
  maintenance: { emoji: '🚧', label: 'Maintenance' },
  projectManagement: { emoji: '📆', label: 'Project Management' },
  ideas: { emoji: '🤔', label: 'Ideas & Feedback' },
  test: { emoji: '⚠️', label: 'Tests' },
  bug: { emoji: '🐛', label: 'Bug Reports' },
  review: { emoji: '👀', label: 'Code Review' },
  design: { emoji: '🎨', label: 'Design' },
  example: { emoji: '💡', label: 'Examples' },
  content: { emoji: '🖋', label: 'Content' },
  tutorial: { emoji: '✅', label: 'Tutorials' },
  question: { emoji: '💬', label: 'Questions' },
  security: { emoji: '🛡️', label: 'Security' },
  tool: { emoji: '🔧', label: 'Tools' },
  translation: { emoji: '🌍', label: 'Translation' },
  financial: { emoji: '💵', label: 'Financial' },
  fundingFinding: { emoji: '🔍', label: 'Funding Finding' },
  audio: { emoji: '🔊', label: 'Audio' },
  video: { emoji: '📹', label: 'Videos' },
  talk: { emoji: '📢', label: 'Talks' },
  blog: { emoji: '📝', label: 'Blog Posts' },
  eventOrganizing: { emoji: '📋', label: 'Event Organizing' },
  userTesting: { emoji: '📓', label: 'User Testing' },
  data: { emoji: '🔣', label: 'Data' },
  platform: { emoji: '📦', label: 'Packaging' },
  a11y: { emoji: '♿️', label: 'Accessibility' },
  mentoring: { emoji: '🧑‍🏫', label: 'Mentoring' },
  plugin: { emoji: '🔌', label: 'Plugin' },
  promotion: { emoji: '📣', label: 'Promotion' },
  research: { emoji: '🔬', label: 'Research' },
}

/** Props for the inline {@link ContributorCard} component */
type ContributorCardProps = { contributor: Contributor }

function ContributorCard({ contributor }: ContributorCardProps) {
  return (
    <a
      href={contributor.profile}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-primary-600 dark:hover:bg-primary-950/30"
    >
      <img
        src={contributor.avatar_url}
        alt={contributor.name}
        className="h-16 w-16 rounded-full border-2 border-slate-200 dark:border-slate-600"
      />
      <span className="mt-2 font-medium text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {contributor.name}
      </span>
      <span className="text-sm text-slate-500 dark:text-slate-400">@{contributor.login}</span>
      <div className="mt-2 flex flex-wrap justify-center gap-1">
        {contributor.contributions.map((type) => {
          const info = CONTRIBUTION_EMOJI[type] || { emoji: '✨', label: type }
          return (
            <span key={type} title={info.label} className="text-sm">
              {info.emoji}
            </span>
          )
        })}
      </div>
    </a>
  )
}

/** Props for the inline {@link ContributorsSection} component */
type ContributorsSectionProps = { contributors: Contributor[] }

function ContributorsSection({ contributors }: ContributorsSectionProps) {
  if (contributors.length === 0) {
    return null
  }

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Contributors</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Thanks to these wonderful people who have contributed to hyperfrontend:</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {contributors.map((contributor) => (
          <ContributorCard key={contributor.login} contributor={contributor} />
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        This project follows the{' '}
        <a
          href="https://allcontributors.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          all-contributors
        </a>{' '}
        specification. Contributions of any kind are welcome!
      </p>
    </section>
  )
}

export default async function AcknowledgmentsPage() {
  const content = getAcknowledgments()
  const contributors = getContributors()

  if (!content) {
    return (
      <>
        <Breadcrumb />
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Acknowledgments</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Acknowledgments documentation is coming soon. Check back later.</p>
        <ContributorsSection contributors={contributors} />
      </>
    )
  }

  const { processedContent, diagrams } = extractMermaidBlocks(content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Breadcrumb />
      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
      <ContributorsSection contributors={contributors} />
    </>
  )
}
