import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import App from '../App.svelte'

describe('App', () => {
  it('mounts a frame the koi can be rendered into', () => {
    const root = document.createElement('div')
    const app = mount(App, { target: root })

    expect(root.querySelector('.koi-frame')).not.toBeNull()

    void unmount(app)
  })
})
