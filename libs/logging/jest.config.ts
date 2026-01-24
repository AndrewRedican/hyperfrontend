import type { Config } from 'jest'

export default <Config>{
  displayName: 'logging',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/logging',
  testEnvironment: 'node',
}
