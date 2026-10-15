import { describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../models/conventional'
import { toDraft } from './draft'

describe('toDraft', () => {
  it('copies every field from a commit into a draft', () => {
    const commit = createConventionalCommit('feat', 'add login', {
      scope: ['core'],
      body: 'Full body',
      footers: [{ key: 'Refs', value: '#1', separator: ':' }],
      breaking: true,
      breakingDescription: 'removes X',
    })

    expect(toDraft(commit)).toEqual({
      type: 'feat',
      scope: ['core'],
      subject: 'add login',
      body: 'Full body',
      footers: [{ key: 'Refs', value: '#1', separator: ':' }],
      breaking: true,
      breakingDescription: 'removes X',
    })
  })

  it('carries through default array / boolean fields', () => {
    const commit = createConventionalCommit('fix', 'oops')

    expect(toDraft(commit)).toEqual({
      type: 'fix',
      subject: 'oops',
      scope: [],
      footers: [],
      breaking: false,
      body: undefined,
      breakingDescription: undefined,
    })
  })
})
