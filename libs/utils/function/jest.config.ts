import type { Config } from 'jest'

export default <Config>{
  displayName: 'function-utils',
  preset: '../../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/function',
  testEnvironment: 'node',
}
