import { routedUnencryptedPacket } from '../creators/mocks'
import { isValidRoutedUnencryptedPacket } from './is-valid-routed-unencrypted-packet'

describe('isValidRoutedUnencryptedPacket', () => {
  it('returns true for a valid routed unencrypted packet', () => {
    expect(isValidRoutedUnencryptedPacket(routedUnencryptedPacket)).toBe(true)
  })

  it('returns false for anything other than a valid routed unencrypted packet', () => {
    expect(isValidRoutedUnencryptedPacket(void 0)).toBe(false)
    expect(isValidRoutedUnencryptedPacket(null)).toBe(false)
    expect(isValidRoutedUnencryptedPacket([])).toBe(false)
    expect(isValidRoutedUnencryptedPacket({ topicId: '' })).toBe(false)
  })
})
