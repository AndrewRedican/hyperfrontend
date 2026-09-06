/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from '@hyperfrontend/testing'
import { wirePacket } from '../../packet/creators/mocks'
import { topicId } from '../../topic/creators/mocks'
import { isValidRoutedWirePacket } from '../validations/is-valid-routed-wire-packet'
import { createRoutedWirePacket } from './create-routed-wire-packet'

describe('createRoutedWirePacket', () => {
  it('throws error when topicId is not valid', () => {
    expect(() => createRoutedWirePacket('', wirePacket)).toThrow('Cannot create a routed wire packet without a valid topic')
  })

  it('throws error when wire packet is not valid', () => {
    expect(() => createRoutedWirePacket(topicId, {} as any)).toThrow('Cannot create a routed wire packet without a valid wire packet')
  })

  it('creates a routed wire packet', () => {
    const result = createRoutedWirePacket(topicId, wirePacket)
    expect(isValidRoutedWirePacket(result)).toBe(true)
  })
})
