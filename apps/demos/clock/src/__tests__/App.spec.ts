import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'

describe('App', () => {
  it('renders the clock coin as a focusable, labelled button', () => {
    const wrapper = mount(App)
    expect(wrapper.get('button.coin-button').attributes('aria-label')).toContain('Clock coin showing its analog face')
  })

  it('renders a polite live region for announcements', () => {
    const wrapper = mount(App)
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
  })
})
