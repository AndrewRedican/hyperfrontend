import type { GuideIndexEntry } from '@/lib/guides'

const TYPE_LABELS = {
  tutorial: 'Tutorial',
  'how-to': 'How-to',
  troubleshooting: 'Troubleshooting',
  recipe: 'Recipe',
} as const

const TYPE_STYLES = {
  tutorial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  'how-to': 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200',
  troubleshooting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  recipe: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
} as const

interface GuideTypeBadgeProps {
  /** Diátaxis-aligned guide type */
  type: GuideIndexEntry['type']
}

/**
 * Small pill naming a guide's document type.
 * @param props - Component props
 * @param props.type - Diátaxis-aligned guide type
 * @returns The rendered badge
 */
export function GuideTypeBadge({ type }: GuideTypeBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  )
}

interface VerificationBadgeProps {
  /** How the guide's code examples are proven to execute */
  verification: GuideIndexEntry['verification']
}

/**
 * Badge describing how a guide's code examples were proven correct: extracted
 * from source that ships and runs, or executed against a named package version
 * on a named date. The reader is told which, and how old the claim is.
 * @param props - Component props
 * @param props.verification - How the guide's examples were proven correct
 * @returns The rendered badge
 */
export function VerificationBadge({ verification }: VerificationBadgeProps) {
  const target = (verification.verifiedAgainst ?? '').replace('@hyperfrontend/', '').replace('@', ' ')
  const label = verification.kind === 'demo' ? 'Code from a running demo' : `Verified · ${target || 'published package'}`

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
      title={
        verification.kind === 'authored'
          ? 'Examples were run against this version on this date'
          : 'Extracted from source that ships and runs'
      }
    >
      <CheckIcon className="h-3 w-3" />
      {label}
      {verification.kind === 'authored' && verification.verifiedOn ? (
        <span className="font-normal opacity-75">· {verification.verifiedOn}</span>
      ) : null}
    </span>
  )
}

type IconProps = { className?: string }

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}
