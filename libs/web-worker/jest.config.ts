import type { Config } from 'jest'

export default <Config>{
  displayName: 'web-worker',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/web-worker',
  testEnvironment: 'jsdom',
}
