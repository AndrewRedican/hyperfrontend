import { describe, expect, it } from 'vitest'
import '../koi-fish'

describe('<koi-fish>', () => {
  it('upgrades into a frame the koi can be rendered into', async () => {
    const element = document.createElement('koi-fish')
    document.body.append(element)
    await element.updateComplete

    expect(element.shadowRoot?.querySelector('.koi-frame')).not.toBeNull()

    element.remove()
  })
})
