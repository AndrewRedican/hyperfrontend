import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'
import { featureUi } from '../state/feature-ui'

/** A fake feature handle capturing subscriptions and sends. */
function createLink() {
  const handlers = new Map<string, (data: unknown) => void>()
  const sends: Array<{ type: string; data: unknown }> = []
  featureUi.attach({
    on(event, handler) {
      handlers.set(event, handler)
      return () => handlers.delete(event)
    },
    send(type, data) {
      sends.push({ type, data })
    },
  })
  const emit = (event: string, data: unknown) => {
    handlers.get(event)?.(data)
  }
  return { sends, emit }
}

describe('dialog-mode chrome', () => {
  it('renders no close chrome while nothing has been presented', () => {
    createLink()
    const wrapper = mount(App)
    expect(wrapper.find('.dialog-close').exists()).toBe(false)
  })

  it('renders no close chrome in embedded mode', async () => {
    const { emit } = createLink()
    const wrapper = mount(App)
    emit('presentation', { mode: 'embedded' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dialog-close').exists()).toBe(false)
  })

  it('renders the close chrome only when the host announces dialog mode', async () => {
    const { emit } = createLink()
    const wrapper = mount(App)
    emit('presentation', { mode: 'dialog' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dialog-close').exists()).toBe(true)
  })

  it('activating the close button emits exactly one close-request over the wire', async () => {
    const { emit, sends } = createLink()
    const wrapper = mount(App)
    emit('presentation', { mode: 'dialog' })
    await wrapper.vm.$nextTick()
    await wrapper.get('.dialog-close').trigger('click')
    await wrapper.get('.dialog-close').trigger('click')
    expect(sends).toEqual([{ type: 'close-request', data: { source: 'button' } }])
  })

  it('the chrome leaves when the session closes', async () => {
    const { emit } = createLink()
    const wrapper = mount(App)
    emit('presentation', { mode: 'dialog' })
    await wrapper.vm.$nextTick()
    emit('close', undefined)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dialog-close').exists()).toBe(false)
  })
})
