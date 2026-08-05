import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DialogCloseControls from '../DialogCloseControls.vue'

describe('DialogCloseControls', () => {
  it('renders an accessibly labelled circular close button', () => {
    const wrapper = mount(DialogCloseControls)
    expect(wrapper.get('button.dialog-close').attributes('aria-label')).toBe('Close dialog')
  })

  it('shows the escape hint beside the button', () => {
    const wrapper = mount(DialogCloseControls)
    expect(wrapper.get('.dialog-esc-hint').text()).toBe('esc')
  })

  it('emits close-request when the button is activated', async () => {
    const wrapper = mount(DialogCloseControls)
    await wrapper.get('button.dialog-close').trigger('click')
    expect(wrapper.emitted('close-request')).toHaveLength(1)
  })
})
