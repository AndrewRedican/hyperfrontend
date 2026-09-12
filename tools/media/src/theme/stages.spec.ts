import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import { describe, expect, it } from '@hyperfrontend/testing'
import { byteStage } from '../byte/stage'
import { dialStage } from '../dial/stage'
import { flowStage } from '../flow/stage'
import { gaugeStage } from '../gauge/stage'
import { lifecycleStage } from '../lifecycle/stage'
import { panelStage } from '../panel/stage'
import { scanStage } from '../scan/stage'
import { chapter, sequenceStage } from '../sequence/stage'
import { terminalStage } from '../terminal/stage'
import { resolveTheme } from './resolve'
import { builtInTheme } from './themes'

const profile: MediaProfile = { id: 'test', intent: 'tests', width: 640, height: 360, scale: 1, fps: 10 }

/** One shipped stage with the smallest configuration it accepts, its type parameter erased. */
interface Shipped {
  /** The stage. */
  stage: Stage<unknown>
  /** A configuration it draws. */
  config: unknown
}

/**
 * Pair a stage with a configuration, checking the two against each other here.
 *
 * @param stage - The stage under test.
 * @param config - A configuration it accepts.
 * @returns The pair, typed for a table every stage can sit in.
 */
function shipped<TConfig>(stage: Stage<TConfig>, config: TConfig): Shipped {
  return { stage: stage as Stage<unknown>, config }
}

/** Every stage that ships, each with one small scene. */
const STAGES: readonly Shipped[] = [
  shipped(terminalStage, { title: 'sh', script: [{ step: 'type', text: 'ls' }] }),
  shipped(flowStage, { left: { title: 'host' }, right: { title: 'feature' }, messages: [{ from: 'left', label: 'hello', atMs: 0 }] }),
  shipped(panelStage, { heading: 'h', caption: 'c', panels: [{ title: 'p', kind: 'code', chrome: true, rows: [{ text: 'x', atMs: 0 }] }] }),
  shipped(gaugeStage, {
    heading: 'h',
    caption: 'c',
    groups: [{ title: 'g', tracks: [{ label: 'l', max: 1, stops: [{ atMs: 0, value: 1 }] }] }],
  }),
  shipped(byteStage, {
    heading: 'h',
    source: 's',
    caption: 'c',
    segments: [{ label: 'l', count: 2, atMs: 0 }],
    annotations: [{ text: 'a', atMs: 0 }],
  }),
  shipped(scanStage, {
    heading: 'h',
    caption: 'c',
    root: 'r/',
    files: [{ path: 'a', atMs: 0 }],
    findings: [{ label: 'f', evidence: 'e', confidence: 50, file: 0, atMs: 0 }],
  }),
  shipped(dialStage, {
    heading: 'h',
    caption: 'c',
    dials: [{ title: 'd', max: 1, stops: [{ atMs: 0, value: 1 }] }],
    overlay: { atMs: 0, untilMs: 100, title: 't', detail: 'd', action: 'a' },
  }),
  shipped(lifecycleStage, {
    heading: 'h',
    caption: 'c',
    panels: [{ title: 'p', teardown: false, note: 'n' }],
    cycles: 1,
    cycleMs: 100,
    listenersPerMount: 1,
  }),
  shipped(sequenceStage, { segments: [chapter('one', panelStage, { panels: [{ kind: 'result', rows: [{ text: 'x', atMs: 0 }] }] })] }),
]

/** The stages by name, for a table the runner can label. */
const TABLE = STAGES.map((entry) => [entry.stage.id, entry] as const)

/** A theme whose faces and success tone belong to no built-in table, so their presence proves they were read. */
const distinct = resolveTheme('dark', undefined, { all: { tones: { success: '#a1b2c3' }, fonts: { sans: 'SpecSans', mono: 'SpecMono' } } })

describe('every shipped stage', () => {
  it.each(TABLE)('%s colours its stylesheet with the tones of the theme it is handed', (_id, entry) => {
    expect(entry.stage.styles(entry.config, profile, distinct)).toEqual(expect.stringContaining('#a1b2c3'))
  })

  it.each(TABLE)('%s sets its type in the theme faces rather than its own', (_id, entry) => {
    const css = entry.stage.styles(entry.config, profile, distinct)
    expect([css.includes('SpecSans') || css.includes('SpecMono'), css.includes('Liberation')]).toEqual([true, false])
  })

  it.each(TABLE)('%s draws differently in the portable and dark themes', (_id, entry) => {
    expect(entry.stage.styles(entry.config, profile, builtInTheme('portable'))).not.toBe(
      entry.stage.styles(entry.config, profile, builtInTheme('dark'))
    )
  })

  it.each(TABLE)('%s draws every moment of its timeline in every theme', (_id, entry) => {
    const durationMs = entry.stage.durationMs(entry.config, profile)
    const frames = (['portable', 'dark', 'light'] as const).flatMap((id) =>
      [0, durationMs / 2, durationMs].map((atMs) => entry.stage.frame({ config: entry.config, profile, theme: builtInTheme(id), atMs }))
    )
    expect(frames.every((markup) => markup.length > 0)).toBe(true)
  })
})
