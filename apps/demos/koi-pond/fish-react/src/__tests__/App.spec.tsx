import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../App'

// why: React refuses to let `act` drive a tree until the environment declares itself a test runner, and vitest sets no such flag on its own.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('App', () => {
  it('mounts a frame the koi can be rendered into', async () => {
    const root = document.createElement('div')
    await act(async () => {
      createRoot(root).render(<App />)
    })

    expect(root.querySelector('.koi-frame')).not.toBeNull()
  })
})
