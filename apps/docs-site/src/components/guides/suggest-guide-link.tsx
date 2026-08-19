import { buildGuideRequestUrl } from '@/lib/guide-request'

interface SuggestGuideLinkProps {
  /** npm package the reader is looking at, when the view is package-scoped */
  packageName?: string
  /** Visual weight: a quiet inline link, or a bordered button for an empty view */
  variant?: 'inline' | 'button'
  /** Link text; defaults to the wording used across the site */
  label?: string
}

/**
 * The way a reader asks for a guide that does not exist yet: a link opening a
 * prefilled GitHub issue in a new tab, carrying the package they were looking
 * at so triage does not have to guess. They review and submit it on GitHub.
 * @param props - Component props
 * @param props.packageName - npm package the reader is looking at, when the view is package-scoped
 * @param props.variant - Quiet inline link, or bordered button for an empty view
 * @param props.label - Link text
 * @returns The rendered request action
 */
export function SuggestGuideLink({ packageName, variant = 'inline', label = 'Suggest a guide' }: SuggestGuideLinkProps) {
  const className =
    variant === 'button'
      ? 'inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40'
      : 'inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400'

  return (
    <a href={buildGuideRequestUrl(packageName)} target="_blank" rel="noopener noreferrer" className={className}>
      <GitHubIcon className="h-4 w-4 shrink-0" />
      {label}
    </a>
  )
}

type IconProps = { className?: string }

function GitHubIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  )
}
