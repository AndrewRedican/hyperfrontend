import { conventionalPreset } from './conventional'

describe('conventionalPreset', () => {
  it('lists steps in the D8 order', () => {
    expect(conventionalPreset.map((step) => step.id)).toEqual([
      'resolve-scope',
      'type',
      'scope',
      'subject',
      'body',
      'breaking',
      'issues',
      'preview',
      'commit',
    ])
  })
})
