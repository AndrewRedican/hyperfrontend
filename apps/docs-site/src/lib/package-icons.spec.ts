import { describe, expect, it } from 'vitest'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { PACKAGE_MARKS } from '../components/package/package-marks'
import { LIBRARIES } from './content'

describe('PACKAGE_MARKS', () => {
  it('covers every documented package, so no card falls back to the generic outline', () => {
    const missing = LIBRARIES.filter((library) => !(library.packageName in PACKAGE_MARKS)).map((library) => library.packageName)
    expect(missing).toEqual([])
  })

  it('draws nothing the library index does not publish', () => {
    const published = LIBRARIES.map((library) => library.packageName)
    const orphaned = keys(PACKAGE_MARKS).filter((packageName) => !published.includes(packageName))
    expect(orphaned).toEqual([])
  })
})
