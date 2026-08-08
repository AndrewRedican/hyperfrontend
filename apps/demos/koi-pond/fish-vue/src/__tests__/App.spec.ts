import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import App from '../App.vue'

describe('App', () => {
  it('mounts a frame the koi can be rendered into', () => {
    const root = document.createElement('div')
    const app = createApp(App)
    app.mount(root)

    expect(root.querySelector('.koi-frame')).not.toBeNull()

    app.unmount()
  })
})
