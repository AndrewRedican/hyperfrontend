import { mount } from '@vue/test-utils'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'

describe('accessibility', () => {
  it('has no axe violations on the mounted app', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const results = await axe.run(wrapper.element, {
      // note: Color-contrast needs a real rendering engine; jsdom has no layout.
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
