import { resolveHostBinary } from './host-binary'

describe('resolveHostBinary', () => {
  it('returns the supplied currentExecPath when the platform matches', () => {
    expect(resolveHostBinary({ platform: 'linux-x64', currentExecPath: '/opt/node', currentPlatform: 'linux-x64' })).toBe('/opt/node')
  })

  it('falls back to process.execPath when currentExecPath is omitted', () => {
    const target = `${process.platform}-${process.arch}`
    expect(resolveHostBinary({ platform: target as never })).toBe(process.execPath)
  })

  it('throws when the requested platform does not match the current host', () => {
    expect(() => resolveHostBinary({ platform: 'win32-x64', currentPlatform: 'linux-x64' })).toThrow(
      /Cannot resolve host binary for win32-x64/
    )
  })

  it('mentions the actual current platform in the thrown error', () => {
    expect(() => resolveHostBinary({ platform: 'darwin-arm64', currentPlatform: 'linux-arm64' })).toThrow(
      /current platform \(linux-arm64\)/
    )
  })

  it('uses process.platform / process.arch as the default current-platform comparison', () => {
    const target = `${process.platform}-${process.arch}` as never
    expect(() => resolveHostBinary({ platform: target })).not.toThrow()
  })

  it('throws when comparing against the live current-platform default and platform mismatches', () => {
    const mismatched = process.platform === 'linux' ? 'win32-x64' : 'linux-x64'
    expect(() => resolveHostBinary({ platform: mismatched as never })).toThrow(/Cannot resolve host binary/)
  })
})
