import type { MediaProfile } from '../models/profile'
import { describe, expect, it } from '@hyperfrontend/testing'
import { builtInTheme } from '../theme/themes'
import { STAGE_ELEMENT_ID, stageDocument } from './document'

const profile: MediaProfile = { id: 'test', intent: 'tests', width: 320, height: 180, scale: 1, fps: 10 }

describe('stageDocument', () => {
  it('sizes the page and the stage element to the profile', () => {
    expect(stageDocument('', profile, builtInTheme('dark'))).toEqual(
      expect.stringMatching(/html, body \{[^}]*width: 320px; height: 180px;[\s\S]*#stage \{[^}]*width: 320px;[^}]*height: 180px;/)
    )
  })

  it('paints an opaque theme edge to edge on the stage element', () => {
    const theme = builtInTheme('dark')
    expect(stageDocument('', profile, theme)).toContain(`#${STAGE_ELEMENT_ID} { background: ${theme.backdrop}; }`)
  })

  it('leaves the page clear around a portable plate with its own edge', () => {
    const theme = builtInTheme('portable')
    const stage = stageDocument('', profile, theme).split('html, body { background: transparent; }')[1] ?? ''
    expect(stage).toEqual(
      expect.stringMatching(/#stage \{[^}]*background: #161b26;[^}]*border: 1px solid #3f4a5e;[^}]*border-radius: 14px;/)
    )
  })

  it("sets the theme's face and text colour on the stage element", () => {
    const theme = builtInTheme('light')
    const rule = stageDocument('', profile, theme).match(/#stage \{[^}]*\}/)?.[0] ?? ''
    expect(rule).toEqual(expect.stringContaining(`font-family: ${theme.fonts.sans};\n  color: ${theme.text.plain};`))
  })

  it("mounts the stage's stylesheet after its own, so the stage can override the ground", () => {
    const document = stageDocument('.mine { x: 1; }', profile, builtInTheme('dark'))
    expect(document.indexOf('.mine { x: 1; }')).toBeGreaterThan(document.indexOf(`#${STAGE_ELEMENT_ID} { background`))
  })
})
