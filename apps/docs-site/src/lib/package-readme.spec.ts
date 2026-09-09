import { describe, expect, it } from 'vitest'
import { preparePackageReadme } from './package-readme'

/** A README shaped like the ones this site publishes. */
const README = ['One line about the package.', '', '## Part of hyperfrontend', '', 'This library is part of the monorepo.', ''].join('\n')

describe('preparePackageReadme', () => {
  it('leaves the page only what it renders itself', () => {
    const body = preparePackageReadme(README)
    expect(body).not.toContain('## Part of hyperfrontend')
    expect(body).toContain('One line about the package.')
  })
})
