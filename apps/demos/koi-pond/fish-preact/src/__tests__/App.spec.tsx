import { describe, expect, it } from 'vitest'
import { render } from 'preact'
import { App } from '../App'

describe('App', () => {
  it('mounts a frame the koi can be rendered into', () => {
    const root = document.createElement('div')
    render(<App />, root)

    expect(root.querySelector('.koi-frame')).not.toBeNull()
  })
})
