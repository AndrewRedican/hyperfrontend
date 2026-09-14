import type { MediaProfile } from '../models/profile'
import type { Stage, StageInstant } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { describe, expect, it } from '@hyperfrontend/testing'
import { defineStage } from '../stage/define-stage'
import { builtInTheme } from '../theme/themes'
import { chapter, sequenceStage } from './stage'

const profile: MediaProfile = { id: 'test', intent: 'tests', width: 640, height: 360, scale: 1, fps: 10 }
const theme: MediaTheme = builtInTheme('dark')

/** What a chapter's stage was asked to draw. */
interface DotConfig {
  /** The text drawn in the frame. */
  text: string
  /** How long the chapter runs. */
  durationMs: number
}

/** A stage that writes its configuration and its moment into the markup. */
const dotStage: Stage<DotConfig> = defineStage<DotConfig>({
  id: 'dot',
  styles: (config, given, look) => `.dot { color: ${look.accent}; width: ${given.height}px; content: "${config.text}"; }`,
  durationMs: (config) => config.durationMs,
  frame: ({ config, atMs, theme: look }: StageInstant<DotConfig>) =>
    `<span class="dot" data-at="${atMs}" data-accent="${look.accent}">${config.text}</span>`,
})

/** A stage that fails however it is asked. */
const brokenStage: Stage<DotConfig> = defineStage<DotConfig>({
  id: 'broken',
  styles: () => {
    throw new Error('no stylesheet')
  },
  durationMs: () => {
    throw new Error('no duration')
  },
  frame: () => {
    throw new Error('no frame')
  },
})

const twoChapters = {
  transitionMs: 500,
  segments: [
    chapter('First', dotStage, { text: 'one', durationMs: 1_000 }, 200),
    chapter('Second', dotStage, { text: 'two', durationMs: 1_000 }),
  ],
}

describe('chapter', () => {
  it('binds the stage to its configuration and carries the hold', () => {
    const bound = chapter('Detect', dotStage, { text: 'x', durationMs: 700 }, 300)
    expect([bound.label, bound.holdMs, bound.durationMs(profile), bound.frame(profile, theme, 250)]).toEqual([
      'Detect',
      300,
      700,
      `<span class="dot" data-at="250" data-accent="${theme.accent}">x</span>`,
    ])
  })

  it('holds for nothing when no hold is given', () => {
    expect(chapter('Detect', dotStage, { text: 'x', durationMs: 700 }).holdMs).toBe(0)
  })

  it('hands the theme through to the stylesheet', () => {
    expect(chapter('Detect', dotStage, { text: 'x', durationMs: 1 }).styles(profile, theme)).toContain(`color: ${theme.accent}`)
  })

  it.each([
    ['styles', (bound: ReturnType<typeof chapter>) => bound.styles(profile, theme), 'no stylesheet'],
    ['durationMs', (bound: ReturnType<typeof chapter>) => bound.durationMs(profile), 'no duration'],
    ['frame', (bound: ReturnType<typeof chapter>) => bound.frame(profile, theme, 0), 'no frame'],
  ])('names the chapter when its stage throws from %s', (_name, call, message) => {
    expect(() => call(chapter('Stage, then commit', brokenStage, { text: '', durationMs: 0 }))).toThrow(
      `Chapter "Stage, then commit": ${message}`
    )
  })

  it('names the chapter when its stage throws something that is not an error', () => {
    const odd: Stage<DotConfig> = {
      ...brokenStage,
      frame: () => {
        throw 'plain string'
      },
    }
    expect(() => chapter('Odd', odd, { text: '', durationMs: 0 }).frame(profile, theme, 0)).toThrow('Chapter "Odd": plain string')
  })
})

describe('sequenceStage', () => {
  it('runs for every chapter, hold and transition added up', () => {
    expect(sequenceStage.durationMs(twoChapters, profile)).toBe(2_700)
  })

  it('composes each chapter against the frame less the rail', () => {
    expect(sequenceStage.styles(twoChapters, profile, theme)).toContain('width: 332px')
  })

  it('gives the rail more room on a wide frame', () => {
    expect(sequenceStage.styles(twoChapters, { ...profile, width: 928, height: 522 }, theme)).toContain('width: 488px')
  })

  it('composes each chapter against the whole frame when there is no rail', () => {
    expect(sequenceStage.styles({ ...twoChapters, rail: false }, profile, theme)).toContain('width: 360px')
  })

  it('lights the running step in the plate colour on a transparent theme, where white would glare', () => {
    const portable = builtInTheme('portable')
    expect(sequenceStage.styles(twoChapters, profile, portable)).toContain(
      `.seq-step--now .seq-index { background: ${portable.accent}; border-color: ${portable.accent}; color: ${portable.plate}; }`
    )
  })

  it('lights the running step in white on an opaque theme', () => {
    expect(sequenceStage.styles(twoChapters, profile, theme)).toContain(
      `.seq-step--now .seq-index { background: ${theme.accent}; border-color: ${theme.accent}; color: #ffffff; }`
    )
  })

  it("confines each chapter's stylesheet to its own element", () => {
    expect(sequenceStage.styles(twoChapters, profile, theme)).toEqual(
      expect.stringMatching(/\.seq-chapter--0 \.dot \{[^}]*content: "one"[\s\S]*\.seq-chapter--1 \.dot \{[^}]*content: "two"/)
    )
  })

  it('draws the running chapter alone, at its own offset', () => {
    expect(sequenceStage.frame({ config: twoChapters, profile, theme, atMs: 400 })).toEqual(
      expect.stringMatching(
        /^<div class="seq-rail">[\s\S]*<\/div><div class="seq-chapter seq-chapter--0"[^>]*><span class="dot" data-at="400"[^>]*>one<\/span><\/div>$/
      )
    )
  })

  it('draws both chapters during the move, the first held on its last frame', () => {
    const frame = sequenceStage.frame({ config: twoChapters, profile, theme, atMs: 1_450 })
    expect(frame).toEqual(
      expect.stringMatching(
        /seq-chapter--0[^>]*opacity: 0\.500[\s\S]*data-at="1000"[\s\S]*seq-chapter--1[^>]*opacity: 0\.500[\s\S]*data-at="0"/
      )
    )
  })

  it('lights the running chapter on the rail and marks the ones before it done', () => {
    const frame = sequenceStage.frame({ config: twoChapters, profile, theme, atMs: 2_000 })
    expect(frame).toEqual(
      expect.stringMatching(
        /seq-step--done[^<]*<span class="seq-index">1<\/span>First[\s\S]*seq-step--now[^<]*<span class="seq-index">2<\/span>Second/
      )
    )
  })

  it('fills the rail in proportion to how far through the chapters the sequence is', () => {
    expect(sequenceStage.frame({ config: twoChapters, profile, theme, atMs: 600 })).toContain('style="width:25.00%"')
  })

  it('draws no rail when the scene turns it off', () => {
    expect(sequenceStage.frame({ config: { ...twoChapters, rail: false }, profile, theme, atMs: 600 })).not.toContain('seq-rail')
  })

  it('escapes a chapter label on the rail', () => {
    const config = { segments: [chapter('<b>bold</b>', dotStage, { text: 'x', durationMs: 100 })] }
    expect(sequenceStage.frame({ config, profile, theme, atMs: 0 })).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('fails on an empty sequence before drawing anything', () => {
    expect(() => sequenceStage.durationMs({ segments: [] }, profile)).toThrow('A sequence needs at least one chapter')
  })

  it('hands the same theme to every chapter', () => {
    const frame = sequenceStage.frame({ config: twoChapters, profile, theme: builtInTheme('light'), atMs: 1_450 })
    expect(frame.match(/data-accent="([^"]+)"/g)).toEqual([
      `data-accent="${builtInTheme('light').accent}"`,
      `data-accent="${builtInTheme('light').accent}"`,
    ])
  })

  it('draws a single chapter as a plain scene with a one-step rail', () => {
    const config = { segments: [chapter('Only', dotStage, { text: 'solo', durationMs: 500 })] }
    expect(sequenceStage.frame({ config, profile, theme, atMs: 250 })).toEqual(
      expect.stringMatching(
        /seq-step--now[^<]*<span class="seq-index">1<\/span>Only[\s\S]*seq-chapter--0[^>]*>[^<]*<span class="dot" data-at="250"/
      )
    )
  })
})
