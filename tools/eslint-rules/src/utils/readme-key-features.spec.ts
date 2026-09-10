import type { KeyFeaturesProblem } from './readme-key-features'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  analyzeKeyFeatures,
  isFeatureBullet,
  MAX_FEATURE_LABEL_CHARACTERS,
  MAX_KEY_FEATURES,
  MIN_FEATURE_DESCRIPTION_CHARACTERS,
  MIN_KEY_FEATURES,
  parseFeatureBullet,
} from './readme-key-features'

/**
 * A well-formed feature bullet, used where a test needs filler that passes every check.
 *
 * @param index - The number to label the feature with.
 * @returns A bullet with a short label and a substantial explanation.
 */
function validBullet(index: number): string {
  return `- **Feature ${index}** - what this feature gives the reader in practice`
}

/**
 * Runs the analysis over a Key Features body, framed by the headings that surround it.
 *
 * @param body - The section body, excluding the heading itself.
 * @returns Every problem the analysis found.
 */
function analyzeBody(body: string): KeyFeaturesProblem[] {
  const lines = ['### Key Features', '', ...body.split('\n'), '', '### Next']
  return analyzeKeyFeatures(lines, { startLine: 1, endLine: lines.length - 1 })
}

/**
 * Reads the message identifiers out of a problem list.
 *
 * @param problems - The problems to summarise.
 * @returns The identifiers, in the order they were reported.
 */
function messageIds(problems: KeyFeaturesProblem[]): string[] {
  return problems.map((problem) => problem.messageId)
}

describe('readme-key-features', () => {
  describe('isFeatureBullet', () => {
    it('accepts a dash bullet at column zero', () => {
      expect(isFeatureBullet('- **Label** - explanation')).toBe(true)
    })

    it('accepts an asterisk bullet at column zero', () => {
      expect(isFeatureBullet('* **Label** - explanation')).toBe(true)
    })

    it('rejects an indented bullet', () => {
      expect(isFeatureBullet('  - **Label** - explanation')).toBe(false)
    })

    it('rejects a dash with no space after it', () => {
      expect(isFeatureBullet('-**Label**')).toBe(false)
    })

    it('rejects a paragraph', () => {
      expect(isFeatureBullet('This package offers the following:')).toBe(false)
    })
  })

  describe('parseFeatureBullet', () => {
    it('splits a label from a dash-separated explanation', () => {
      expect(parseFeatureBullet('- **Zero dependencies** - nothing outside the platform')).toEqual({
        label: 'Zero dependencies',
        description: 'nothing outside the platform',
      })
    })

    it('splits a label from a colon-separated explanation', () => {
      expect(parseFeatureBullet('- **Zero dependencies**: nothing outside the platform')).toEqual({
        label: 'Zero dependencies',
        description: 'nothing outside the platform',
      })
    })

    it('keeps an explanation that continues the label as a clause', () => {
      expect(parseFeatureBullet('- **Value picker** for cyclical iteration')).toEqual({
        label: 'Value picker',
        description: 'for cyclical iteration',
      })
    })

    it('reports no label when the bullet opens with plain text', () => {
      expect(parseFeatureBullet('- Zero dependencies, nothing outside the platform')).toEqual({ label: null, description: '' })
    })

    it('reports no label when the bold marker never closes', () => {
      expect(parseFeatureBullet('- **Zero dependencies')).toEqual({ label: null, description: '' })
    })

    it('reports no label when the bold marker wraps nothing', () => {
      expect(parseFeatureBullet('- **** explanation only')).toEqual({ label: null, description: '' })
    })

    it('returns an empty description for a bare label', () => {
      expect(parseFeatureBullet('- **Zero dependencies**')).toEqual({ label: 'Zero dependencies', description: '' })
    })

    it('returns an empty description when only a separator follows the label', () => {
      expect(parseFeatureBullet('- **Zero dependencies** -')).toEqual({ label: 'Zero dependencies', description: '' })
    })
  })

  describe('analyzeKeyFeatures', () => {
    it('accepts a flat list of labelled features', () => {
      expect(analyzeBody([validBullet(1), validBullet(2), validBullet(3)].join('\n'))).toEqual([])
    })

    it('accepts asterisk bullets', () => {
      const body = [validBullet(1), validBullet(2), validBullet(3)].join('\n').replaceAll('- **', '* **')
      expect(analyzeBody(body)).toEqual([])
    })

    it('accepts an HTML comment parked in the list', () => {
      const body = [validBullet(1), validBullet(2), validBullet(3), '<!-- TODO(asset): a terminal capture of the flow -->'].join('\n')
      expect(analyzeBody(body)).toEqual([])
    })

    it('accepts an HTML comment that spans several lines', () => {
      const body = [validBullet(1), validBullet(2), validBullet(3), '<!-- TODO(asset):', '     a terminal capture', '-->'].join('\n')
      expect(analyzeBody(body)).toEqual([])
    })

    it('reports a lead-in paragraph above the list', () => {
      const body = ['This package offers:', '', validBullet(1), validBullet(2), validBullet(3)].join('\n')
      const problems = analyzeBody(body)

      expect(messageIds(problems)).toEqual(['keyFeaturesNotAList'])
      expect(problems[0]).toMatchObject({ line: 3, data: { line: 'This package offers:' } })
    })

    it('reports a nested bullet', () => {
      const body = [validBullet(1), '  - a detail hanging off the first feature', validBullet(2), validBullet(3)].join('\n')
      const problems = analyzeBody(body)

      expect(messageIds(problems)).toEqual(['keyFeaturesNotAList'])
      expect(problems[0]).toMatchObject({ line: 4, data: { line: '- a detail hanging off the first feature' } })
    })

    it('reports every row of a table standing in for the list', () => {
      const body = ['| Feature | Why |', '| ------- | --- |', '| One     | Two |'].join('\n')

      expect(messageIds(analyzeBody(body))).toEqual(['keyFeaturesNotAList', 'keyFeaturesNotAList', 'keyFeaturesNotAList'])
    })

    it('reports a fenced block once rather than once per line inside it', () => {
      const body = [validBullet(1), validBullet(2), validBullet(3), '```typescript', 'const a = 1', 'const b = 2', '```'].join('\n')
      const problems = analyzeBody(body)

      expect(messageIds(problems)).toEqual(['keyFeaturesNotAList'])
      expect(problems[0]).toMatchObject({ line: 6, data: { line: '```typescript' } })
    })

    it('stops at the end of the section when a fence never closes', () => {
      const body = [validBullet(1), validBullet(2), validBullet(3), '~~~', 'const a = 1'].join('\n')

      expect(messageIds(analyzeBody(body))).toEqual(['keyFeaturesNotAList'])
    })

    it('stops at the end of the section when an HTML comment never closes', () => {
      const body = [validBullet(1), validBullet(2), validBullet(3), '<!-- TODO(asset): a capture'].join('\n')

      expect(analyzeBody(body)).toEqual([])
    })

    it('shortens a long offending line so the message stays readable', () => {
      const body = `${'A lead-in sentence that runs well past the length a message can quote. '.repeat(2)}\n\n${[validBullet(1), validBullet(2), validBullet(3)].join('\n')}`
      const quoted = analyzeBody(body)[0]?.data.line ?? ''

      expect(quoted.endsWith('...')).toBe(true)
      expect(quoted.length).toBeLessThanOrEqual(63)
    })

    it('reports a bullet with no bold label', () => {
      const body = [validBullet(1), validBullet(2), '- runs everywhere the platform runs'].join('\n')
      const problems = analyzeBody(body)

      expect(messageIds(problems)).toEqual(['keyFeatureMissingLabel'])
      expect(problems[0]).toMatchObject({ line: 5, data: { feature: 'runs everywhere the platform runs' } })
    })

    it('reports a bullet that is a bare label', () => {
      const body = [validBullet(1), validBullet(2), '- **Tree shakeable**'].join('\n')
      const problems = analyzeBody(body)

      expect(messageIds(problems)).toEqual(['keyFeatureMissingDescription'])
      expect(problems[0]).toMatchObject({ line: 5, data: { feature: 'Tree shakeable' } })
    })

    it('reports a label that has grown into a sentence', () => {
      const label = 'Everything this package does for you and then some more'
      const body = [validBullet(1), validBullet(2), `- **${label}** - and here is the explanation of it`].join('\n')
      const problems = analyzeBody(body)

      expect(messageIds(problems)).toEqual(['keyFeatureLabelTooLong'])
      expect(problems[0]?.data).toMatchObject({ characters: `${label.length}`, maximum: `${MAX_FEATURE_LABEL_CHARACTERS}` })
    })

    it('reports an explanation that only restates the label', () => {
      const body = [validBullet(1), validBullet(2), '- **Fast** - it is fast'].join('\n')
      const problems = analyzeBody(body)

      expect(messageIds(problems)).toEqual(['keyFeatureDescriptionTooShort'])
      expect(problems[0]?.data).toMatchObject({
        feature: 'Fast',
        characters: '10',
        minimum: `${MIN_FEATURE_DESCRIPTION_CHARACTERS}`,
      })
    })

    it('reports a list with fewer features than a package needs', () => {
      const problems = analyzeBody([validBullet(1), validBullet(2)].join('\n'))

      expect(messageIds(problems)).toEqual(['keyFeaturesTooFew'])
      expect(problems[0]).toMatchObject({ line: 1, data: { count: '2', minimum: `${MIN_KEY_FEATURES}` } })
    })

    it('reports a list with more features than a reader takes in', () => {
      const bullets: string[] = []
      for (let index = 1; index <= MAX_KEY_FEATURES + 1; index++) {
        bullets.push(validBullet(index))
      }
      const problems = analyzeBody(bullets.join('\n'))

      expect(messageIds(problems)).toEqual(['keyFeaturesTooMany'])
      expect(problems[0]).toMatchObject({ line: 1, data: { count: `${MAX_KEY_FEATURES + 1}`, maximum: `${MAX_KEY_FEATURES}` } })
    })

    it('leaves the feature count alone when the section holds no bullets at all', () => {
      expect(messageIds(analyzeBody('Prose where the list should be.'))).toEqual(['keyFeaturesNotAList'])
    })

    it('numbers problems by their line in the file rather than in the section', () => {
      const lines = ['# Title', '', '## What is it?', '', '### Key Features', '', '- **Fast** - it is fast enough for anyone', '']
      const problems = analyzeKeyFeatures(lines, { startLine: 5, endLine: lines.length })

      expect(problems[0]).toMatchObject({ messageId: 'keyFeaturesTooFew', line: 5 })
    })

    it('tolerates a section range that runs past the end of the file', () => {
      expect(analyzeKeyFeatures(['### Key Features'], { startLine: 1, endLine: 12 })).toEqual([])
    })
  })
})
