import type { Config } from 'jest'

export default {
  displayName: 'data-utils',
  preset: '../../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/data',
  testEnvironment: 'node',
} as Config
