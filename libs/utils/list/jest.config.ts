import type { Config } from 'jest'

export default {
  displayName: 'list-utils',
  preset: '../../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/list',
  testEnvironment: 'node',
} as Config
