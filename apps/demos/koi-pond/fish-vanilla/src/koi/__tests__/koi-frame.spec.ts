import { describe, expect, it } from 'vitest'
import { mountKoiFrame } from '../koi-frame'

describe('mountKoiFrame', () => {
  it('mounts a frame the koi can be rendered into', () => {
    const root = document.createElement('div')
    const frame = mountKoiFrame(root)

    expect(root.querySelector('.koi-frame')).toBe(frame)
  })
})
