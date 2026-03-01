import type { Config } from 'jest'

export default <Config>{
  displayName: 'eslint-rules',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/eslint-rules',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 92,
      functions: 100,
      lines: 98,
      statements: 98,
    },
  },
}
