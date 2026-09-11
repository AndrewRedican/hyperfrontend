import type { EnvironmentId, EnvironmentSupport, OutputFormatId, PackageCompatibility, PackageOutput } from '@/lib/package-facts'
import type { ReactNode } from 'react'
import { ENVIRONMENT_PRESENTATION } from './technology-marks'

/** Props for {@link PackageCapabilities}. */
export interface PackageCapabilitiesProps {
  /** Where the package says it runs, or null when it declares nothing */
  compatibility: PackageCompatibility | null
  /** What the package's build target emits */
  outputs: PackageOutput[]
}

/** Props for {@link CapabilityGroup}. */
interface CapabilityGroupProps {
  /** What the group is called */
  title: string
  /** The chips in it */
  children: ReactNode
}

/** How one support level is drawn, and what it says to a reader who cannot see the colour. */
interface SupportPresentation {
  /** Colour and border classes for the chip */
  tone: string
  /** The level in words, read out but not shown */
  sr: string
  /** A short mark shown beside the runtime, so the level survives without colour */
  glyph: string
}

/** How one output format is named and explained. */
interface OutputPresentation {
  /** What the format is called */
  label: string
  /** What a reader reaches for it for */
  purpose: string
}

/** The runtimes a compatibility group lists, in the order it lists them. */
const ENVIRONMENT_ORDER: readonly EnvironmentId[] = ['node', 'browser', 'webWorker']

/**
 * What each support level looks like and, for anyone not reading the colour,
 * what it says.
 *
 * Colour never carries the answer on its own: every chip also states its level
 * in text a screen reader reaches, and the levels differ in weight and border
 * as well as hue.
 */
const SUPPORT_PRESENTATION: Record<EnvironmentSupport, SupportPresentation> = {
  full: {
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    sr: 'supported',
    glyph: '✓',
  },
  partial: {
    tone: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    sr: 'partially supported',
    glyph: '~',
  },
  none: {
    tone: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500',
    sr: 'not supported',
    glyph: '—',
  },
}

/**
 * What each output format is for, so a chip says something a reader can act on
 * rather than only naming an acronym.
 */
const OUTPUT_PRESENTATION: Record<OutputFormatId, OutputPresentation> = {
  esm: { label: 'ESM', purpose: 'Bundlers and native modules' },
  cjs: { label: 'CJS', purpose: 'Node and older bundlers' },
  iife: { label: 'IIFE', purpose: 'Script tag, no bundler' },
  umd: { label: 'UMD', purpose: 'AMD, CommonJS, or a global' },
  bin: { label: 'CLI', purpose: 'Installed on your PATH' },
}

/**
 * Where a package runs and what it publishes, as two compact groups of chips.
 *
 * Both facts used to be full-width tables at the foot of every package page,
 * and neither ever had more than a handful of cells in it: a table that says
 * "Node.js yes, browser yes" spends a screen of height on two words. The chips
 * carry the same claims, keep them scannable, and sit side by side wherever
 * there is room for two columns, so the pair costs one band of the page rather
 * than two.
 *
 * Neither group is invented for symmetry. A package that declares no
 * compatibility gets no runtime group, and a package with no build target gets
 * no output group; a page with one of the two shows one, full width.
 * @param props - See {@link PackageCapabilitiesProps}.
 * @param props.compatibility - Where the package says it runs
 * @param props.outputs - What the package's build target emits
 * @returns The panel, or nothing when the package states neither.
 */
export function PackageCapabilities({ compatibility, outputs }: PackageCapabilitiesProps) {
  const hasOutputs = outputs.length > 0
  if (!compatibility && !hasOutputs) return null

  const columns = compatibility && hasOutputs ? 'md:grid-cols-2' : 'md:grid-cols-1'

  return (
    <div
      className={`not-prose my-6 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700 ${columns}`}
    >
      {compatibility && (
        <CapabilityGroup title="Runs on">
          <ul className="flex flex-wrap gap-2">
            {ENVIRONMENT_ORDER.map((environment) => (
              <EnvironmentChip
                key={environment}
                environment={environment}
                support={compatibility.environments[environment]}
                detail={environment === 'node' ? compatibility.nodeRange : undefined}
              />
            ))}
          </ul>
          {compatibility.note && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{withCodeSpans(compatibility.note)}</p>
          )}
        </CapabilityGroup>
      )}

      {hasOutputs && (
        <CapabilityGroup title="Ships as">
          <ul className="flex flex-wrap gap-2">
            {outputs.map((output) => (
              <OutputChip key={output.format} output={output} />
            ))}
          </ul>
        </CapabilityGroup>
      )}
    </div>
  )
}

/**
 * One labelled half of the panel.
 * @param props - See {@link CapabilityGroupProps}.
 * @param props.title - What the group is called
 * @param props.children - The chips in it
 * @returns The group.
 */
function CapabilityGroup({ title, children }: CapabilityGroupProps) {
  return (
    <section className="bg-white p-4 dark:bg-slate-900">
      <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{title}</h3>
      {children}
    </section>
  )
}

/** Props for {@link EnvironmentChip}. */
interface EnvironmentChipProps {
  /** Which runtime the chip is about */
  environment: EnvironmentId
  /** How completely the package supports it */
  support: EnvironmentSupport
  /** A version range to qualify the claim, when the package declares one */
  detail?: string
}

/**
 * One runtime, its mark, and how completely the package supports it.
 * @param props - See {@link EnvironmentChipProps}.
 * @param props.environment - Which runtime the chip is about
 * @param props.support - How completely the package supports it
 * @param props.detail - A version range qualifying the claim
 * @returns The chip.
 */
function EnvironmentChip({ environment, support, detail }: EnvironmentChipProps) {
  const { label, Mark } = ENVIRONMENT_PRESENTATION[environment]
  const state = SUPPORT_PRESENTATION[support]

  return (
    <li className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${state.tone}`}>
      <Mark className="h-4 w-4 shrink-0 opacity-80" />
      <span>{label}</span>
      {detail && <span className="font-mono text-[0.6875rem] opacity-70">{detail}</span>}
      <span aria-hidden="true" className="font-semibold opacity-70">
        {state.glyph}
      </span>
      <span className="sr-only">{state.sr}</span>
    </li>
  )
}

/** Props for {@link OutputChip}. */
interface OutputChipProps {
  /** The output the chip describes */
  output: PackageOutput
}

/**
 * One published output, named and placed.
 * @param props - See {@link OutputChipProps}.
 * @param props.output - The output the chip describes
 * @returns The chip.
 */
function OutputChip({ output }: OutputChipProps) {
  const { label, purpose } = OUTPUT_PRESENTATION[output.format]

  return (
    <li className="inline-flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</span>
      <span className="text-[0.6875rem] leading-tight text-slate-500 dark:text-slate-400">{outputDetail(output) ?? purpose}</span>
    </li>
  )
}

/**
 * Render a declaration's backtick spans as code.
 *
 * A compatibility note is written where the package is configured, by whoever
 * changes the package, and the entry points it names are code. Backticks are
 * how that is said everywhere else in this repository, so they are honoured
 * here rather than asking the author to write the note twice or to leave the
 * identifiers unmarked.
 * @param note - The declared note, with backtick code spans
 * @returns The note with its code spans marked up
 */
function withCodeSpans(note: string): ReactNode[] {
  return note.split('`').map((piece, index) =>
    index % 2 === 1 ? (
      <code
        key={index}
        className="rounded bg-slate-100 px-1 font-mono text-[0.6875rem] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      >
        {piece}
      </code>
    ) : (
      <span key={index}>{piece}</span>
    )
  )
}

/**
 * The one fact that distinguishes this package's take on a format from every
 * other package's, when there is one.
 * @param output - The output to describe
 * @returns The distinguishing detail, or null when the format's general purpose says it better
 */
function outputDetail(output: PackageOutput): string | null {
  if (output.format === 'esm' && output.treeShakeable) return 'Tree-shakeable'
  // why: one bundle is worth naming by the global it defines; several would spend the whole chip on identifiers, so the count is the useful fact and the README's own CDN section carries the names
  if (output.globalNames && output.globalNames.length > 0) {
    return output.globalNames.length === 1 ? output.globalNames[0] : `${output.globalNames.length} bundles`
  }
  if (output.binaries && output.binaries.length > 0) {
    const commands = output.binaries.join(', ')
    return output.native ? `${commands}, plus native builds` : commands
  }
  return null
}
