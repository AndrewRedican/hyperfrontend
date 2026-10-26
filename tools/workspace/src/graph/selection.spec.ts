import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { ChangeStatus, ReasonRule } from './selection'

describe('the selection vocabulary', () => {
  it('closes the change statuses and the reason rules', () => {
    expect([keys(ChangeStatus), keys(ReasonRule).length]).toEqual([['Added', 'Modified', 'Deleted', 'Renamed'], 18])
  })
})
