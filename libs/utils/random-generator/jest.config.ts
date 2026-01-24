import type { Config } from 'jest'

export default <Config>{
  displayName: 'random-generator-utils',
  preset: '../../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/random-generator',
  testEnvironment: 'node',
}
