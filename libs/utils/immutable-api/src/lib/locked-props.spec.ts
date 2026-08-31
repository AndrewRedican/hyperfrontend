import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lockedProps } from './locked-props'

describe('lockedProps', () => {
  let object: object

  beforeEach(() => {
    object = {}
    lockedProps(object, [
      ['a', 5],
      ['b', false],
    ])
  })

  it('assigns property values', () => {
    expect(Object.getOwnPropertyDescriptor(object, 'a')?.value).toEqual(5)
    expect(Object.getOwnPropertyDescriptor(object, 'b')?.value).toEqual(false)
  })

  it('prevents property values to be changed', () => {
    expect(Object.getOwnPropertyDescriptor(object, 'a')?.writable).toEqual(false)
    expect(Object.getOwnPropertyDescriptor(object, 'b')?.writable).toEqual(false)
  })

  it('prevents property descriptors to be changed', () => {
    expect(Object.getOwnPropertyDescriptor(object, 'a')?.configurable).toEqual(false)
    expect(Object.getOwnPropertyDescriptor(object, 'b')?.configurable).toEqual(false)
  })
})
