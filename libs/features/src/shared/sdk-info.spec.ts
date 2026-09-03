import { describe, expect, it } from '@hyperfrontend/testing'
import { sdkInfo } from './sdk-info'

describe('sdkInfo', () => {
  it('reports the published hyperfrontend features package name', () => {
    expect(sdkInfo.packageName).toBe('@hyperfrontend/features')
  })
})
