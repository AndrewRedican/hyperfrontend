import { describe, expect, it } from '@hyperfrontend/testing'
import { parseVersion, parseVersionStrict, coerceVersion } from './version'

describe('parseVersion', () => {
  describe('valid versions', () => {
    it('parses basic version', () => {
      const result = parseVersion('1.2.3')
      expect(result.success).toBe(true)
      expect(result.version?.major).toBe(1)
      expect(result.version?.minor).toBe(2)
      expect(result.version?.patch).toBe(3)
    })

    it('parses version with leading v', () => {
      const result = parseVersion('v1.0.0')
      expect(result.success).toBe(true)
      expect(result.version?.major).toBe(1)
    })

    it('parses version with prerelease', () => {
      const result = parseVersion('1.0.0-alpha.1')
      expect(result.success).toBe(true)
      expect(result.version?.prerelease).toEqual(['alpha', '1'])
    })

    it('parses version with build metadata', () => {
      const result = parseVersion('1.0.0+build.123')
      expect(result.success).toBe(true)
      expect(result.version?.build).toEqual(['build', '123'])
    })

    it('parses version with prerelease and build', () => {
      const result = parseVersion('1.0.0-beta.2+build.456')
      expect(result.success).toBe(true)
      expect(result.version?.prerelease).toEqual(['beta', '2'])
      expect(result.version?.build).toEqual(['build', '456'])
    })

    it('parses 0.0.0', () => {
      const result = parseVersion('0.0.0')
      expect(result.success).toBe(true)
      expect(result.version?.major).toBe(0)
    })

    it('handles leading/trailing whitespace', () => {
      const result = parseVersion('  1.0.0  ')
      expect(result.success).toBe(true)
      expect(result.version?.major).toBe(1)
    })

    it('handles = prefix', () => {
      const result = parseVersion('=1.0.0')
      expect(result.success).toBe(true)
      expect(result.version?.major).toBe(1)
    })
  })

  describe('invalid versions', () => {
    it('rejects empty string', () => {
      const result = parseVersion('')
      expect(result.success).toBe(false)
    })

    it('rejects leading zeros', () => {
      const result = parseVersion('01.0.0')
      expect(result.success).toBe(false)
      expect(result.error).toContain('leading zeros')
    })

    it('rejects missing minor', () => {
      const result = parseVersion('1')
      expect(result.success).toBe(false)
    })

    it('rejects missing patch', () => {
      const result = parseVersion('1.2')
      expect(result.success).toBe(false)
    })

    it('rejects non-numeric version', () => {
      const result = parseVersion('a.b.c')
      expect(result.success).toBe(false)
    })

    it('rejects version exceeding max length', () => {
      const result = parseVersion('1.' + '0'.repeat(300))
      expect(result.success).toBe(false)
      expect(result.error).toContain('maximum length')
    })

    it('rejects invalid characters', () => {
      const result = parseVersion('1.0.0$invalid')
      expect(result.success).toBe(false)
    })

    it('rejects invalid patch version (non-numeric)', () => {
      const result = parseVersion('1.2.a')
      expect(result.success).toBe(false)
    })

    it('rejects empty prerelease identifier', () => {
      const result = parseVersion('1.2.3-alpha..beta')
      expect(result.success).toBe(false)
    })

    it('rejects version with leading zeros', () => {
      const result = parseVersion('01.2.3')
      expect(result.success).toBe(false)
      expect(result.error).toContain('leading zeros')
    })
  })
})

describe('parseVersionStrict', () => {
  it('returns version on success', () => {
    const v = parseVersionStrict('1.2.3')
    expect(v.major).toBe(1)
  })

  it('throws on invalid version', () => {
    expect(() => parseVersionStrict('invalid')).toThrow()
  })
})

describe('coerceVersion', () => {
  it('coerces partial versions', () => {
    expect(coerceVersion('1')?.major).toBe(1)
    expect(coerceVersion('1')?.minor).toBe(0)
    expect(coerceVersion('1')?.patch).toBe(0)
  })

  it('coerces two-part versions', () => {
    expect(coerceVersion('1.2')?.major).toBe(1)
    expect(coerceVersion('1.2')?.minor).toBe(2)
    expect(coerceVersion('1.2')?.patch).toBe(0)
  })

  it('handles v prefix', () => {
    expect(coerceVersion('v2')?.major).toBe(2)
  })

  it('returns null for invalid input', () => {
    expect(coerceVersion('')).toBeNull()
    expect(coerceVersion('abc')).toBeNull()
  })

  it('handles leading whitespace', () => {
    expect(coerceVersion('  1.2.3')?.major).toBe(1)
  })

  it('handles trailing whitespace', () => {
    expect(coerceVersion('1.2.3  ')?.major).toBe(1)
  })

  it('handles both leading and trailing whitespace', () => {
    expect(coerceVersion('  1.2  ')?.major).toBe(1)
    expect(coerceVersion('  1.2  ')?.minor).toBe(2)
  })

  it('handles uppercase V prefix', () => {
    expect(coerceVersion('V2.0')?.major).toBe(2)
  })

  it('coerces three-part version with patch', () => {
    expect(coerceVersion('1.2.3')?.patch).toBe(3)
  })
})

describe('parseVersion - edge cases', () => {
  it('parses trailing hyphen as empty prerelease', () => {
    const result = parseVersion('1.2.3-')
    expect(result.success).toBe(true)
  })

  it('handles numeric overflow in major version', () => {
    const result = parseVersion('99999999999999999999.0.0')
    expect(result.success).toBe(false)
    expect(result.error).toContain('too large')
  })

  it('strips equals prefix', () => {
    const result = parseVersion('=1.2.3')
    expect(result.success).toBe(true)
    expect(result.version?.major).toBe(1)
  })

  it('handles multiple prerelease identifiers', () => {
    const result = parseVersion('1.0.0-alpha.beta.gamma')
    expect(result.success).toBe(true)
    expect(result.version?.prerelease).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('handles prerelease with numeric and text', () => {
    const result = parseVersion('1.0.0-rc.1.test')
    expect(result.success).toBe(true)
    expect(result.version?.prerelease).toEqual(['rc', '1', 'test'])
  })

  it('rejects missing dot after major', () => {
    const result = parseVersion('1')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Expected "."')
  })

  it('rejects missing dot after minor', () => {
    const result = parseVersion('1.2')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Expected "."')
  })

  it('rejects invalid minor version', () => {
    const result = parseVersion('1.abc.3')
    expect(result.success).toBe(false)
  })

  it('rejects invalid patch version', () => {
    const result = parseVersion('1.2.abc')
    expect(result.success).toBe(false)
  })

  it('rejects leading zeros in minor', () => {
    const result = parseVersion('1.01.3')
    expect(result.success).toBe(false)
    expect(result.error).toContain('leading zeros')
  })

  it('rejects leading zeros in patch', () => {
    const result = parseVersion('1.2.03')
    expect(result.success).toBe(false)
    expect(result.error).toContain('leading zeros')
  })

  it('handles build metadata', () => {
    const result = parseVersion('1.2.3+build.123')
    expect(result.success).toBe(true)
    expect(result.version?.build).toEqual(['build', '123'])
  })

  it('handles both prerelease and build metadata', () => {
    const result = parseVersion('1.2.3-alpha.1+build.456')
    expect(result.success).toBe(true)
    expect(result.version?.prerelease).toEqual(['alpha', '1'])
    expect(result.version?.build).toEqual(['build', '456'])
  })
})

describe('coerceVersion - edge cases', () => {
  it('coerces single digit', () => {
    const v = coerceVersion('1')
    expect(v?.major).toBe(1)
    expect(v?.minor).toBe(0)
    expect(v?.patch).toBe(0)
  })

  it('coerces two-part version', () => {
    const v = coerceVersion('1.2')
    expect(v?.major).toBe(1)
    expect(v?.minor).toBe(2)
    expect(v?.patch).toBe(0)
  })

  it('coerces with v prefix', () => {
    const v = coerceVersion('v1')
    expect(v?.major).toBe(1)
  })

  it('returns null for non-numeric', () => {
    expect(coerceVersion('abc')).toBeNull()
  })

  it('handles whitespace', () => {
    const v = coerceVersion('  1.2  ')
    expect(v?.major).toBe(1)
  })
})

describe('parseVersionStrict - error fallback', () => {
  it('throws with error message from parseVersion', () => {
    expect(() => parseVersionStrict('invalid')).toThrow()
  })

  it('throws for non-string input', () => {
    expect(() => parseVersionStrict(null as unknown as string)).toThrow()
  })

  it('throws for undefined input', () => {
    expect(() => parseVersionStrict(undefined as unknown as string)).toThrow()
  })
})

describe('coerceVersion - minor parsing edge cases', () => {
  it('handles version where minor fails to parse after dot', () => {
    const v = coerceVersion('1.')
    expect(v?.major).toBe(1)
    expect(v?.minor).toBe(0)
  })

  it('handles version with invalid character after minor dot', () => {
    const v = coerceVersion('1.abc')
    expect(v?.major).toBe(1)
    expect(v?.minor).toBe(0)
  })

  it('handles version where patch fails to parse', () => {
    const v = coerceVersion('1.2.abc')
    expect(v?.major).toBe(1)
    expect(v?.minor).toBe(2)
    expect(v?.patch).toBe(0)
  })

  it('coerces version with extra content after patch', () => {
    const v = coerceVersion('1.2.3extra')
    expect(v?.major).toBe(1)
    expect(v?.minor).toBe(2)
    expect(v?.patch).toBe(3)
  })
})

describe('coerceVersion - invalid input handling', () => {
  it('coerces version with invalid minor after dot', () => {
    const v = coerceVersion('1.!')
    expect(v?.major).toBe(1)
    expect(v?.minor).toBe(0)
  })

  it('handles version with only whitespace', () => {
    expect(coerceVersion('   ')).toBeNull()
  })
})

describe('parseVersion - additional error paths', () => {
  it('handles versions with only trailing whitespace', () => {
    const result = parseVersion('1.2.3   ')
    expect(result.success).toBe(true)
    expect(result.version?.patch).toBe(3)
  })

  it('handles versions with mixed whitespace', () => {
    const result = parseVersion('  1.2.3  ')
    expect(result.success).toBe(true)
    expect(result.version?.major).toBe(1)
  })

  it('rejects invalid characters in patch', () => {
    const result = parseVersion('1.2.!')
    expect(result.success).toBe(false)
  })

  it('rejects version with extra segments', () => {
    const result = parseVersion('1.2.3.4.5')
    expect(typeof result.success).toBe('boolean')
  })
})

describe('parseVersion - prerelease and build metadata', () => {
  it('rejects missing patch version', () => {
    const result = parseVersion('1.2')
    expect(result.success).toBe(false)
  })

  it('handles V prefix uppercase', () => {
    const result = parseVersion('V1.2.3')
    expect(result.success).toBe(true)
    expect(result.version?.major).toBe(1)
  })

  it('handles version starting with leading zeros in major', () => {
    const result = parseVersion('01.2.3')
    expect(result.success).toBe(false)
  })

  it('handles build metadata without prerelease', () => {
    const result = parseVersion('1.2.3+build')
    expect(result.success).toBe(true)
    expect(result.version?.build).toContain('build')
  })
})

describe('parseVersion - identifier parsing errors', () => {
  it('rejects invalid characters in prerelease identifier', () => {
    const result = parseVersion('1.2.3-alpha$beta')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid character')
  })

  it('rejects invalid characters in build metadata', () => {
    const result = parseVersion('1.2.3+build$123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid character')
  })

  it('rejects trailing dot in prerelease', () => {
    const result = parseVersion('1.2.3-alpha.')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Identifier expected after dot')
  })

  it('rejects trailing dot in build metadata', () => {
    const result = parseVersion('1.2.3+build.')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Identifier expected after dot')
  })
})
