import { describe, expect, it } from '@hyperfrontend/testing'
import { conventionalPreset } from '../presets/conventional'
import { createAuthorSession } from './create-session'

describe('createAuthorSession', () => {
  it('defaults to the conventional step list and resolves the config', () => {
    const session = createAuthorSession()
    expect(session).toEqual(
      expect.objectContaining({
        steps: conventionalPreset,
        config: expect.objectContaining({ skipCommit: false }),
      })
    )
  })

  it('accepts a caller-supplied step list and layers config overrides', () => {
    const steps = conventionalPreset.slice(0, 1)
    const session = createAuthorSession({ steps, config: { cwd: '/repo', skipCommit: true } })

    expect(session).toEqual(
      expect.objectContaining({
        steps,
        config: expect.objectContaining({ cwd: '/repo', skipCommit: true }),
      })
    )
  })
})
