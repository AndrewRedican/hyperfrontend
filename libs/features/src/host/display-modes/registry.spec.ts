import { mountDialog } from './dialog'
import { mountEmbedded } from './embedded'
import { mountPopup } from './popup'
import { selectMount } from './registry'
import { mountStandalone } from './standalone'

describe('selectMount', () => {
  it('resolves the embedded mount', () => {
    expect(selectMount('embedded')).toBe(mountEmbedded)
  })

  it('resolves the dialog mount', () => {
    expect(selectMount('dialog')).toBe(mountDialog)
  })

  it('resolves the popup mount', () => {
    expect(selectMount('popup')).toBe(mountPopup)
  })

  it('resolves the standalone mount', () => {
    expect(selectMount('standalone')).toBe(mountStandalone)
  })
})
