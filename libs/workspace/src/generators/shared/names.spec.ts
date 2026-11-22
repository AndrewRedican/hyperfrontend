import { describe, expect, it } from '@hyperfrontend/testing'
import { assertWritableName, names } from './names'

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

describe('assertWritableName', () => {
  it.each([['web'], ['@acme/data-utils'], ['lib_core.next~1'], ['Site Web'], ['café']])('passes %s', (name) => {
    expect(() => assertWritableName('project name', name)).not.toThrow()
  })

  it.each([
    ['a single quote', "it's"],
    ['a double quote', 'the "one"'],
    ['a backslash', 'back\\slash'],
    ['a line break', 'two\nlines'],
    ['a tab', 'a\tb'],
    ['the end of a comment', 'glob/**/x*/y'],
  ])('refuses a name that holds %s', (_what, name) => {
    expect(() => assertWritableName('project name', name)).toThrow(/^Invalid project name ".*": a name cannot hold /s)
  })

  it('names what the value was given as, and the value as written', () => {
    expect(() => assertWritableName('package name', "@acme/it's")).toThrow(
      'Invalid package name "@acme/it\'s": a name cannot hold a quote, a backslash, a control character or the end of a comment, */'
    )
  })
})
