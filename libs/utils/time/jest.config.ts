import type { Config } from 'jest'

export default {
  displayName: 'time-utils',
  preset: '../../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/time',
  testEnvironment: 'node',
} as Config
