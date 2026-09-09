import { describe, expect, it } from 'vitest'
import { preparePackageReadme } from './package-readme'

/** A README shaped like the ones this site publishes. */
const README = [
  '# @hyperfrontend/example',
  '',
  'One line about the package.',
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
})
