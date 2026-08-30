import type { EngineResult, FitStrength } from '../../lib/decision-engine'

/** How the verdict reads at a glance, before any of its words are. */
type VerdictTone = 'positive' | 'caution' | 'blocked'

/** Props for {@link RecordVerdict}. */
export interface RecordVerdictProps {
  /** The evaluated assessment. */
  result: EngineResult
}

/** Props for the verdict icons. */
interface IconProps {
  /** Sizing and color classes. */
  className?: string
}

/** The verdict's own copy, resolved from the outcome before anything renders. */
interface VerdictCopy {
  /** Colour and glyph grade. */
  tone: VerdictTone
  /** The finding, in one line. */
  headline: string
  /** What the finding means for the reader. */
  subline: string
}

const TONES: Record<VerdictTone, Record<'shell' | 'panel' | 'icon' | 'headline' | 'body', string>> = {
  positive: {
    shell: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-950/30',
    panel: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: 'text-emerald-600 dark:text-emerald-400',
    headline: 'text-emerald-900 dark:text-emerald-200',
    body: 'text-emerald-900/80 dark:text-emerald-100/80',
  },
  caution: {
    shell: 'border-amber-300 bg-amber-50 dark:border-amber-800/70 dark:bg-amber-950/30',
    panel: 'bg-amber-100 dark:bg-amber-900/40',
    icon: 'text-amber-600 dark:text-amber-400',
    headline: 'text-amber-900 dark:text-amber-200',
    body: 'text-amber-900/80 dark:text-amber-100/80',
  },
  blocked: {
    shell: 'border-rose-300 bg-rose-50 dark:border-rose-800/70 dark:bg-rose-950/30',
    panel: 'bg-rose-100 dark:bg-rose-900/40',
    icon: 'text-rose-600 dark:text-rose-400',
    headline: 'text-rose-900 dark:text-rose-200',
    body: 'text-rose-900/80 dark:text-rose-100/80',
  },
}

/**
 * The verdict, first thing on the record: whether HyperFrontend fits, graded.
 *
 * Colour carries the grade so the answer lands before the sentence is read.
 * Green is reserved for a fit the answers actually point at; a fit that merely
 * survives alongside several others is amber, because calling that excellent
 * would oversell it. Anything that rules HyperFrontend out is red under a
 * warning glyph, whether the reader needs a different approach or none at all.
 * @param props - See {@link RecordVerdictProps}.
 * @param props.result
 * @returns The verdict banner.
 * @example
 * ```tsx
 * <RecordVerdict result={evaluate(answers)} />
 * ```
 */
export function RecordVerdict({ result }: RecordVerdictProps) {
  const { tone, headline, subline } = verdictCopy(result)
  const palette = TONES[tone]

  return (
    <div className={`overflow-hidden rounded-2xl border ${palette.shell}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6">
        {/* why: the mark fills the container height on wide screens so the verdict reads before any text does, and caps to a badge on narrow ones */}
        <div className={`flex shrink-0 items-stretch justify-center px-6 py-5 sm:py-6 ${palette.panel}`}>
          {tone === 'blocked' ? (
            <WarningIcon className={`h-14 w-14 self-center sm:h-auto sm:min-h-[7.5rem] sm:w-20 sm:self-stretch ${palette.icon}`} />
          ) : (
            <TickIcon className={`h-14 w-14 self-center sm:h-auto sm:min-h-[7.5rem] sm:w-20 sm:self-stretch ${palette.icon}`} />
          )}
        </div>
        <div className="min-w-0 flex-1 px-6 py-5 sm:pl-0 sm:pr-7">
          <p className="flex items-center gap-2">
            <ProductLogo className="h-5 w-5 shrink-0" />
            <span className="font-display text-lg font-bold text-slate-900 dark:text-white">HyperFrontend</span>
          </p>
          <h2 className={`mt-2 text-xl font-bold ${palette.headline}`}>{headline}</h2>
          <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${palette.body}`}>{subline}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Resolves the verdict's grade and words from the engine outcome.
 * @param result - The evaluated assessment.
 * @returns The tone and the two sentences that go with it.
 */
function verdictCopy(result: EngineResult): VerdictCopy {
  const { alternatives, strength, viable } = result.hyperfrontend

  if (viable && result.outcome === 'microfrontend') {
    return {
      tone: strength === 'only-option' || strength === 'strong' ? 'positive' : 'caution',
      headline: fitHeadline(strength),
      subline: fitSubline(strength, alternatives),
    }
  }

  if (result.outcome === 'no-match') {
    return {
      tone: 'blocked',
      headline: 'Nothing fits every requirement',
      subline:
        'Your requirements combine in a way nothing in the researched set satisfies. That is a real finding rather than a failure to choose: the section below names which single requirement would reopen which options.',
    }
  }

  if (result.outcome === 'baselines-only') {
    return {
      tone: 'blocked',
      headline: 'You do not need microfrontends',
      subline:
        'Every approach that survives your answers ships as one deployment. Adopting a microfrontend architecture would add coordination and runtime cost without buying independence you need.',
    }
  }

  return {
    tone: 'blocked',
    headline: 'Not the right fit',
    subline:
      'Your answers rule out the architecture HyperFrontend implements. What follows is which approaches do fit, and exactly what would have to change for it to become viable.',
  }
}

/**
 * The headline for a viable verdict, graded by how strongly the answers point
 * at this approach rather than merely permitting it.
 * @param strength - The graded fit from the engine.
 * @returns The headline sentence.
 */
function fitHeadline(strength: FitStrength): string {
  switch (strength) {
    case 'only-option':
      return 'Excellent. It is the only approach that fits'
    case 'strong':
      return 'Excellent. It is a strong fit'
    case 'good':
      return 'Good news. It is a good fit'
    default:
      return 'It fits your situation'
  }
}

/**
 * The supporting line for a viable verdict, which stays honest about company:
 * surviving alongside six other approaches is not the same as winning.
 * @param strength - The graded fit from the engine.
 * @param alternatives - How many other microfrontend approaches also survive.
 * @returns The supporting sentence.
 */
function fitSubline(strength: FitStrength, alternatives: number): string {
  if (strength === 'only-option') return 'No other researched approach meets every requirement you stated.'
  if (alternatives === 1) return 'One other approach also meets your requirements. Both are shown below.'
  return `${alternatives} other approaches also meet your requirements, and are shown below.`
}

function ProductLogo({ className }: IconProps) {
  return (
    <>
      <img src="/hf-light.svg" alt="" aria-hidden="true" className={`${className ?? ''} block dark:hidden`} />
      <img src="/hf-dark.svg" alt="" aria-hidden="true" className={`${className ?? ''} hidden dark:block`} />
    </>
  )
}

function TickIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <circle cx="24" cy="24" r="20" strokeWidth={2.5} className="opacity-30" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="m14 24.5 7 7 13-15" />
    </svg>
  )
}

function WarningIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <path
        strokeLinejoin="round"
        strokeWidth={2.5}
        className="opacity-30"
        d="M21.4 6.9 3.9 37.2A3 3 0 0 0 6.5 41.7h35A3 3 0 0 0 44.1 37.2L26.6 6.9a3 3 0 0 0-5.2 0Z"
      />
      <path strokeLinecap="round" strokeWidth={4} d="M24 19v9.5" />
      <path strokeLinecap="round" strokeWidth={4} d="M24 35.2h.02" />
    </svg>
  )
}
