import { parseChangelog } from './parse/parser'
import { serializeChangelog } from './serialize/to-string'

/**
 * Rewrites a changelog the way the write-changelog flow step does: parse the
 * whole file, then serialize the whole file back out.
 *
 * @param markdown - The changelog markdown to rewrite
 * @returns The rewritten markdown
 */
function regenerate(markdown: string): string {
  return serializeChangelog(parseChangelog(markdown))
}

const CLEAN = `# Changelog

All notable changes to this project will be documented in this file.

## 0.7.1 - 2026-08-19

### Breaking Changes

- **BREAKING** coordinate presentation host-side with contract-declared display modes
- **BREAKING** **api:** throw when registering v2 security without a shared key

### Features

- adopt a reloaded feature on its existing mount
`

const REFERENCED = `# Changelog

All notable changes to this project will be documented in this file.

## 1.0.0 - 2026-08-19

### Bug Fixes

- close the leak #123
- fix the thing (abc1234)
- fix the thing again (0123456789abcdef0123456789abcdef01234567)
- handle (beefcafe) tokens
`

const ACCUMULATED = `# Changelog

All notable changes to this project will be documented in this file.

## 0.7.1 - 2026-08-19

### Breaking Changes

- **BREAKING** **BREAKING:** **BREAKING:** coordinate presentation host-side with contract-declared display modes
- **BREAKING** **BREAKING:** **api:** throw when registering v2 security without a shared key

### Features

- adopt a reloaded feature on its existing mount
- **BREAKING** **BREAKING:** **BREAKING:** ⚠️ BREAKING: adopt asynchronous wire-gated open
`

describe('changelog round trip', () => {
  it('leaves serialized output untouched', () => {
    expect(regenerate(CLEAN)).toBe(CLEAN)
  })

  it('stays a fixpoint across repeated rewrites', () => {
    expect(regenerate(regenerate(CLEAN))).toBe(regenerate(CLEAN))
  })

  it('collapses accumulated breaking markers to a single marker', () => {
    expect(regenerate(ACCUMULATED)).toContain('- **BREAKING** coordinate presentation host-side with contract-declared display modes\n')
  })

  it('collapses accumulated markers ahead of a scope prefix', () => {
    expect(regenerate(ACCUMULATED)).toContain('- **BREAKING** **api:** throw when registering v2 security without a shared key\n')
  })

  it('collapses the warning-sign spelling of the marker too', () => {
    expect(regenerate(ACCUMULATED)).toContain('- **BREAKING** adopt asynchronous wire-gated open\n')
  })

  it('settles accumulated markers after a single rewrite', () => {
    expect(regenerate(regenerate(ACCUMULATED))).toBe(regenerate(ACCUMULATED))
  })

  it('leaves items that never carried a marker alone', () => {
    expect(regenerate(ACCUMULATED)).toContain('- adopt a reloaded feature on its existing mount\n')
  })

  it('leaves items carrying issue and commit references untouched', () => {
    expect(regenerate(REFERENCED)).toBe(REFERENCED)
  })

  it('keeps referenced items a fixpoint across repeated rewrites', () => {
    expect(regenerate(regenerate(REFERENCED))).toBe(REFERENCED)
  })
})
