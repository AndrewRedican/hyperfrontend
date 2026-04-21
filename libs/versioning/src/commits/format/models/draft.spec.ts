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

    const draft = toDraft(commit)

    expect(draft.type).toBe('fix')
    expect(draft.subject).toBe('oops')
    expect(draft.scope).toEqual([])
    expect(draft.footers).toEqual([])
    expect(draft.breaking).toBe(false)
    expect(draft.body).toBeUndefined()
    expect(draft.breakingDescription).toBeUndefined()
  })
})
