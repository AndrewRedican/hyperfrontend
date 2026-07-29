import { mountDialog } from './dialog'
import { mountEmbedded } from './embedded'
import { mountPopup } from './popup'
import { builtInDisplayModes } from './registry'
import { mountStandalone } from './standalone'

// why: The suite-wide freeze passthrough (jest.setup.ts) would make the frozen assertion meaningless; this suite needs the real freeze.
jest.unmock('@hyperfrontend/immutable-api-utils/built-in-copy/object')

describe('builtInDisplayModes', () => {
  it('maps every mode to its mount function', () => {
    expect(builtInDisplayModes).toEqual({
      embedded: mountEmbedded,
      dialog: mountDialog,
      popup: mountPopup,
      standalone: mountStandalone,
    })
  })

  it('is frozen', () => {
    expect(Object.isFrozen(builtInDisplayModes)).toBe(true)
  })
})
