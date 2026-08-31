import type { Config } from 'jest'

export default {
  displayName: 'logging',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/logging',
  testEnvironment: 'node',
} as Config
