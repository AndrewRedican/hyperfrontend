import { describe, expect, it } from 'vitest'
import { render } from 'solid-js/web'
import { App } from '../App'

describe('App', () => {
  it('mounts a frame the koi can be rendered into', () => {
    const root = document.createElement('div')
    const dispose = render(() => <App />, root)

    expect(root.querySelector('.koi-frame')).not.toBeNull()

    dispose()
  })
})
