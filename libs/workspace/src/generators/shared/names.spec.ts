import { describe, expect, it } from '@hyperfrontend/testing'
import { names } from './names'

describe('names', () => {
  it.each([
    ['my-lib', { name: 'my-lib', className: 'MyLib', propertyName: 'myLib', constantName: 'MY_LIB', fileName: 'my-lib' }],
    ['MyLib', { name: 'MyLib', className: 'MyLib', propertyName: 'myLib', constantName: 'MY_LIB', fileName: 'my-lib' }],
    ['MY_LIB', { name: 'MY_LIB', className: 'MYLIB', propertyName: 'mYLIB', constantName: 'MY_LIB', fileName: 'my-lib' }],
    [
      'data utils',
      { name: 'data utils', className: 'DataUtils', propertyName: 'dataUtils', constantName: 'DATA_UTILS', fileName: 'data-utils' },
    ],
    ['koi3d', { name: 'koi3d', className: 'Koi3d', propertyName: 'koi3d', constantName: 'KOI3D', fileName: 'koi3d' }],
    ['my-lib-', { name: 'my-lib-', className: 'MyLib', propertyName: 'myLib', constantName: 'MY_LIB', fileName: 'my-lib-' }],
  ])('spells %s in every form as the devkit did', (name, expected) => {
    expect(names(name)).toEqual(expected)
  })
})
