import { describe, expect, it } from 'vitest'
import { CAPABILITIES_PLACEHOLDER, centreLede, preparePackageReadme } from './package-readme'

/** A README shaped like the ones this site publishes. */
const README = [
  '# @hyperfrontend/example',
  '',
  'One line about the package.',
  '',
  '## Compatibility',
  '',
  '| Platform | Support |',
  '| -------- | :-----: |',
  '| Browser  |   ✅    |',
  '',
  '### Output Formats',
  '',
  '| Format | File           |',
  '| ------ | -------------- |',
  '| ESM    | `index.esm.js` |',
  '',
  '### CDN Usage',
  '',
  'Load it from a CDN.',
  '',
  '## Part of hyperfrontend',
  '',
  'This library is part of the monorepo.',
  '',
  '## License',
  '',
  '[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)',
  '',
].join('\n')

describe('preparePackageReadme', () => {
  it('lifts the package title out of the body', () => {
    expect(preparePackageReadme(README).title).toBe('@hyperfrontend/example')
  })

  it('leaves the page only what it renders itself', () => {
    const { body } = preparePackageReadme(README)
    expect(body).not.toContain('## License')
    expect(body).not.toContain('## Part of hyperfrontend')
    expect(body).toContain('One line about the package.')
  })

  it('draws the compatibility tables itself and leaves the subsections it does not model', () => {
    const { body } = preparePackageReadme(README)
    expect(body).toContain(CAPABILITIES_PLACEHOLDER)
    expect(body).not.toContain('### Output Formats')
    expect(body).toContain('## Compatibility')
    expect(body).toContain('### CDN Usage')
  })
})

describe('centreLede', () => {
  it('centres the opening paragraph where it sits, below the showcase and above the first section', () => {
    const body = [
      '<p align="center">',
      '  <img src="hero.gif">',
      '</p>',
      '',
      'One line about',
      'the package.',
      '',
      '## What is it?',
      '',
    ].join('\n')
    expect(centreLede(body)).toBe(
      [
        '<p align="center">',
        '  <img src="hero.gif">',
        '</p>',
        '',
        '<div align="center">',
        '',
        'One line about',
        'the package.',
        '',
        '</div>',
        '',
        '## What is it?',
        '',
      ].join('\n')
    )
  })

  it('leaves a body alone when it opens with a section, a list, or nothing but markup', () => {
    const bodies = ['## Compatibility\n\nText.', '- first\n- second', '<p align="center"><img src="hero.gif"></p>\n']
    expect(bodies.map(centreLede)).toEqual(bodies)
  })
})
