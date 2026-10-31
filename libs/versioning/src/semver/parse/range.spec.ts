import { describe, expect, it } from '@hyperfrontend/testing'
import { parseRange, parseRangeStrict } from './range'

describe('parseRange', () => {
  describe('simple ranges', () => {
    it('parses wildcard', () => {
      const result = parseRange('*')
      expect(result).toEqual(expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [] }) }))
    })

    it('parses exact version', () => {
      const result = parseRange('1.0.0')
      expect(result).toEqual(expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [expect.any(Object)] }) }))
    })

    it('parses >= range', () => {
      const result = parseRange('>=1.0.0')
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          range: expect.objectContaining({
            sets: expect.arrayContaining([
              expect.objectContaining({ comparators: expect.arrayContaining([expect.objectContaining({ operator: '>=' })]) }),
            ]),
          }),
        })
      )
    })

    it('parses < range', () => {
      const result = parseRange('<2.0.0')
      expect(result.success).toBe(true)
    })
  })

  describe('caret ranges', () => {
    it('expands ^1.2.3 to >=1.2.3 <2.0.0', () => {
      const result = parseRange('^1.2.3')
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          range: expect.objectContaining({
            sets: expect.arrayContaining([
              expect.objectContaining({
                comparators: [expect.objectContaining({ operator: '>=' }), expect.objectContaining({ operator: '<' })],
              }),
            ]),
          }),
        })
      )
    })

    it('expands ^0.2.3 to >=0.2.3 <0.3.0', () => {
      const result = parseRange('^0.2.3')
      expect(result.success).toBe(true)
    })

    it('expands ^0.0.3 to >=0.0.3 <0.0.4', () => {
      const result = parseRange('^0.0.3')
      expect(result.success).toBe(true)
    })
  })

  describe('tilde ranges', () => {
    it('expands ~1.2.3 to >=1.2.3 <1.3.0', () => {
      const result = parseRange('~1.2.3')
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          range: expect.objectContaining({
            sets: [
              expect.objectContaining({
                comparators: expect.arrayContaining([
                  expect.objectContaining({ operator: '>=' }),
                  expect.objectContaining({ operator: '<' }),
                ]),
              }),
            ],
          }),
        })
      )
    })
  })

  describe('x-ranges', () => {
    it('handles 1.x', () => {
      const result = parseRange('1.x')
      expect(result.success).toBe(true)
    })

    it('handles 1.2.x', () => {
      const result = parseRange('1.2.x')
      expect(result.success).toBe(true)
    })
  })

  describe('hyphen ranges', () => {
    it('parses 1.0.0 - 2.0.0', () => {
      const result = parseRange('1.0.0 - 2.0.0')
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          range: expect.objectContaining({
            sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
          }),
        })
      )
    })
  })

  describe('OR ranges', () => {
    it('parses 1.0.0 || 2.0.0', () => {
      const result = parseRange('1.0.0 || 2.0.0')
      expect(result).toEqual(
        expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [expect.any(Object), expect.any(Object)] }) })
      )
    })
  })

  describe('AND ranges', () => {
    it('parses >=1.0.0 <2.0.0', () => {
      const result = parseRange('>=1.0.0 <2.0.0')
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          range: expect.objectContaining({
            sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
          }),
        })
      )
    })
  })
})

describe('parseRangeStrict', () => {
  it('returns range on success', () => {
    const r = parseRangeStrict('>=1.0.0')
    expect(r.sets).toHaveLength(1)
  })

  it('throws on empty input', () => {
    expect(() => parseRangeStrict('')).toThrow('Range string is required')
  })
})

describe('parseRange - x-range variations', () => {
  it('parses X (uppercase)', () => {
    const result = parseRange('X')
    expect(result.success).toBe(true)
  })

  it('parses 1.X', () => {
    const result = parseRange('1.X')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object)]) })],
        }),
      })
    )
  })

  it('parses 1.2.X', () => {
    const result = parseRange('1.2.X')
    expect(result.success).toBe(true)
  })

  it('parses empty string as x', () => {
    const result = parseRange('1.')
    expect(result.success).toBe(true)
  })
})

describe('parseRange - error conditions', () => {
  it('rejects range exceeding max length', () => {
    const longRange = '>=1.0.0'.repeat(200)
    const result = parseRange(longRange)
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('maximum length') }))
  })

  it('parses extra dots leniently', () => {
    const result = parseRange('1.2.3.4')
    expect(result.success).toBe(true)
  })
})

describe('parseRange - caret edge cases', () => {
  it('expands ^0.0.5 to >=0.0.5 <0.0.6', () => {
    const result = parseRange('^0.0.5')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '>=', version: expect.objectContaining({ patch: 5 }) }),
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ patch: 6 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })

  it('expands ^0.2.5 to >=0.2.5 <0.3.0', () => {
    const result = parseRange('^0.2.5')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ minor: 3, patch: 0 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })
})

describe('parseRange - x-range edge cases', () => {
  it('rejects invalid x-range with negative number', () => {
    const result = parseRange('-1.x')
    expect(result.success).toBe(false)
  })

  it('parses wildcard with uppercase X', () => {
    const result = parseRange('1.X.X')
    expect(result.success).toBe(true)
  })

  it('parses wildcard with asterisk', () => {
    const result = parseRange('1.*')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })
})

describe('parseRange - hyphen range details', () => {
  it('parses partial left side 1.2 - 2.0.0', () => {
    const result = parseRange('1.2 - 2.0.0')
    expect(result.success).toBe(true)
  })

  it('parses partial right side 1.0.0 - 2', () => {
    const result = parseRange('1.0.0 - 2')
    expect(result.success).toBe(true)
  })
})

describe('parseRange - tilde edge cases', () => {
  it('expands ~0.2.3 to >=0.2.3 <0.3.0', () => {
    const result = parseRange('~0.2.3')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: expect.arrayContaining([
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ minor: 3 }) }),
              ]),
            }),
          ]),
        }),
      })
    )
  })
})

describe('parseRange - complex combinations', () => {
  it('parses multiple OR ranges', () => {
    const result = parseRange('1.0.0 || 2.0.0 || 3.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({ sets: [expect.any(Object), expect.any(Object), expect.any(Object)] }),
      })
    )
  })

  it('parses AND with OR', () => {
    const result = parseRange('>=1.0.0 <2.0.0 || >=3.0.0')
    expect(result).toEqual(
      expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [expect.any(Object), expect.any(Object)] }) })
    )
  })

  it('parses empty comparator set as matching any', () => {
    const result = parseRange('')
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('required') }))
  })

  it('handles multiple spaces between comparators', () => {
    const result = parseRange('>=1.0.0    <2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })

  it('handles tabs between comparators', () => {
    const result = parseRange('>=1.0.0\t<2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })

  it('parses sole wildcard star', () => {
    const result = parseRange('*')
    expect(result).toEqual(expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [] }) }))
  })

  it('parses sole wildcard X', () => {
    const result = parseRange('X')
    expect(result).toEqual(expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [] }) }))
  })

  it('parses 1.x as >=1.0.0 <2.0.0', () => {
    const result = parseRange('1.x')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '>=', version: expect.objectContaining({ major: 1 }) }),
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ major: 2 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })

  it('parses 1.2.x as >=1.2.0 <1.3.0', () => {
    const result = parseRange('1.2.x')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '>=', version: expect.objectContaining({ minor: 2 }) }),
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ minor: 3 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })
})

describe('parseRange - hyphen range edge cases', () => {
  it('detects hyphen range with single space separators', () => {
    const result = parseRange('1.0.0 - 2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: [expect.objectContaining({ operator: '>=' }), expect.objectContaining({ operator: '<=' })],
            }),
          ],
        }),
      })
    )
  })

  it('rejects invalid left side of hyphen range', () => {
    const result = parseRange('abc - 2.0.0')
    expect(result.success).toBe(false)
  })

  it('rejects invalid right side of hyphen range', () => {
    const result = parseRange('1.0.0 - abc')
    expect(result.success).toBe(false)
  })
})

describe('parseRange - invalid comparator versions', () => {
  it('rejects invalid version in >= comparator', () => {
    const result = parseRange('>=abc')
    expect(result.success).toBe(false)
  })

  it('rejects invalid version in < comparator', () => {
    const result = parseRange('<invalid')
    expect(result.success).toBe(false)
  })
})

describe('parseRange - operator', () => {
  it('parses > operator directly', () => {
    const result = parseRange('>1.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: [expect.objectContaining({ operator: '>' })] })],
        }),
      })
    )
  })

  it('parses <= operator directly', () => {
    const result = parseRange('<=2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: [expect.objectContaining({ operator: '<=' })] })],
        }),
      })
    )
  })

  it('parses = operator as exact match', () => {
    const result = parseRange('=1.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: [expect.objectContaining({ operator: '=' })] })],
        }),
      })
    )
  })

  it('handles version number directly (no operator)', () => {
    const result = parseRange('1.0.0')
    expect(result.success).toBe(true)
  })

  it('parses > followed by < in same set', () => {
    const result = parseRange('>1.0.0 <3.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: [expect.objectContaining({ operator: '>' }), expect.objectContaining({ operator: '<' })],
            }),
          ],
        }),
      })
    )
  })

  it('parses multiple operators in OR groups', () => {
    const result = parseRange('>1.0.0 || <0.5.0')
    expect(result).toEqual(
      expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [expect.any(Object), expect.any(Object)] }) })
    )
  })
})

describe('parseRange - x-range invalid number handling', () => {
  it('rejects x-range with non-numeric major part', () => {
    const result = parseRange('abc.x')
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Invalid') }))
  })

  it('rejects x-range with invalid number in first segment', () => {
    const result = parseRange('foo.*.x')
    expect(result.success).toBe(false)
  })

  it('handles x-range starting with wildcard character', () => {
    const result = parseRange('*.x')
    expect(result).toEqual(expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [] }) }))
  })

  it('handles x-range with only x parts', () => {
    const result = parseRange('x.x.x')
    expect(result).toEqual(expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [] }) }))
  })
})

describe('parseRange - whitespace handling', () => {
  it('handles tab characters between comparators', () => {
    const result = parseRange('>=1.0.0\t\t<2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })

  it('handles mixed spaces and tabs', () => {
    const result = parseRange('>=1.0.0 \t <2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })

  it('handles trailing tabs in comparator set', () => {
    const result = parseRange('>=1.0.0\t')
    expect(result.success).toBe(true)
  })
})

describe('parseRangeStrict - error fallback', () => {
  it('throws default error message when error is undefined', () => {
    expect(() => parseRangeStrict(null as unknown as string)).toThrow()
  })

  it('throws with specific error for invalid range', () => {
    expect(() => parseRangeStrict('>=invalid.version')).toThrow('Invalid')
  })
})

describe('parseRange - hyphen range error messages', () => {
  it('returns specific error for invalid left side', () => {
    const result = parseRange('invalid - 2.0.0')
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('left side') }))
  })

  it('returns specific error for invalid right side', () => {
    const result = parseRange('1.0.0 - invalid')
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('right side') }))
  })
})

describe('parseRange - caret range with major > 0', () => {
  it('expands ^2.3.4 to >=2.3.4 <3.0.0', () => {
    const result = parseRange('^2.3.4')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '>=', version: expect.objectContaining({ major: 2 }) }),
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ major: 3, minor: 0, patch: 0 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })
})

describe('parseRange - OR splitting edge cases', () => {
  it('handles empty parts in OR groups', () => {
    const result = parseRange('1.0.0 || || 2.0.0')
    expect(result.success).toBe(true)
  })

  it('handles OR at end of string', () => {
    const result = parseRange('1.0.0 ||')
    expect(result.success).toBe(true)
  })

  it('handles single pipe (not a separator)', () => {
    const result = parseRange('1.0.0 | 2.0.0')
    expect(result.success).toBe(false)
  })
})

describe('parseRange - x-range nums.length branches', () => {
  it('handles x-range with exactly one numeric part before x', () => {
    const result = parseRange('5.x')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '>=', version: expect.objectContaining({ major: 5, minor: 0, patch: 0 }) }),
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ major: 6 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })

  it('handles x-range with exactly two numeric parts before x', () => {
    const result = parseRange('3.4.x')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '>=', version: expect.objectContaining({ major: 3, minor: 4 }) }),
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ minor: 5 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })

  it('handles x-range with asterisk notation for minor', () => {
    const result = parseRange('2.*')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })

  it('handles x-range with asterisk notation for patch', () => {
    const result = parseRange('2.1.*')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })
})

describe('parseRange - expandCaretRange branches', () => {
  it('expands caret range for version with major=0 minor=0', () => {
    const result = parseRange('^0.0.1')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ major: 0, minor: 0, patch: 2 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })

  it('expands caret range for version with major=0 minor>0', () => {
    const result = parseRange('^0.1.5')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ major: 0, minor: 2, patch: 0 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })

  it('expands caret range for version with major>0', () => {
    const result = parseRange('^3.2.1')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [
            expect.objectContaining({
              comparators: expect.arrayContaining([
                expect.objectContaining({ operator: '<', version: expect.objectContaining({ major: 4, minor: 0, patch: 0 }) }),
              ]),
            }),
          ],
        }),
      })
    )
  })
})

describe('parseRange - splitByWhitespace edge cases', () => {
  it('handles multiple consecutive spaces', () => {
    const result = parseRange('>=1.0.0     <2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })

  it('handles multiple consecutive tabs', () => {
    const result = parseRange('>=1.0.0\t\t\t<2.0.0')
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        range: expect.objectContaining({
          sets: [expect.objectContaining({ comparators: expect.arrayContaining([expect.any(Object), expect.any(Object)]) })],
        }),
      })
    )
  })

  it('handles spaces at beginning of comparator set', () => {
    const result = parseRange('   >=1.0.0')
    expect(result.success).toBe(true)
  })

  it('handles spaces at end of comparator set', () => {
    const result = parseRange('>=1.0.0   ')
    expect(result.success).toBe(true)
  })
})

describe('parseRange - parseSimpleVersion edge cases', () => {
  it('handles version with prerelease suffix', () => {
    const result = parseRange('>=1.0.0-alpha')
    expect(result.success).toBe(true)
  })

  it('handles version with build metadata suffix', () => {
    const result = parseRange('>=1.0.0+build')
    expect(result.success).toBe(true)
  })

  it('handles version with v prefix uppercase', () => {
    const result = parseRange('V1.0.0')
    expect(result.success).toBe(true)
  })

  it('handles partial version with only major', () => {
    const result = parseRange('>=1')
    expect(result.success).toBe(true)
  })

  it('handles partial version with major.minor', () => {
    const result = parseRange('>=1.2')
    expect(result.success).toBe(true)
  })
})

describe('parseRange - x-range NaN handling', () => {
  it('rejects x-range with NaN in second segment', () => {
    const result = parseRange('1.abc')
    expect(result.success).toBe(false)
  })

  it('rejects version with negative number', () => {
    const result = parseRange('>=-1.0.0')
    expect(result.success).toBe(false)
  })
})

describe('parseRange - prerelease and build identifiers', () => {
  const comparatorsOf = (input: string) => parseRangeStrict(input).sets[0]?.comparators ?? []
  const version = (fields: Record<string, unknown>) => expect.objectContaining({ version: expect.objectContaining(fields) })

  it('keeps prerelease identifiers on a comparator', () => {
    expect(comparatorsOf('>=1.0.0-alpha.6')).toEqual([version({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '6'], build: [] })])
  })

  it('keeps build identifiers on a comparator', () => {
    expect(comparatorsOf('1.0.0+build.7')).toEqual([version({ prerelease: [], build: ['build', '7'] })])
  })

  it('keeps prerelease and build identifiers together', () => {
    expect(comparatorsOf('>=1.0.0-rc.1+sha.abc')).toEqual([version({ prerelease: ['rc', '1'], build: ['sha', 'abc'] })])
  })

  it('keeps a hyphen inside a prerelease identifier', () => {
    expect(comparatorsOf('1.0.0-alpha-beta')).toEqual([version({ prerelease: ['alpha-beta'] })])
  })

  it('keeps prerelease identifiers behind a v prefix', () => {
    expect(comparatorsOf('v1.0.0-alpha')).toEqual([version({ major: 1, prerelease: ['alpha'] })])
  })

  it('keeps prerelease identifiers on both hyphen range bounds', () => {
    expect(comparatorsOf('1.0.0-alpha - 2.0.0-beta')).toEqual([
      expect.objectContaining({ operator: '>=', version: expect.objectContaining({ major: 1, prerelease: ['alpha'] }) }),
      expect.objectContaining({ operator: '<=', version: expect.objectContaining({ major: 2, prerelease: ['beta'] }) }),
    ])
  })

  it('keeps the prerelease on a caret lower bound and none on the upper bound', () => {
    expect(comparatorsOf('^1.0.0-alpha.1')).toEqual([
      version({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] }),
      version({ major: 2, minor: 0, patch: 0, prerelease: [] }),
    ])
  })

  it('keeps the prerelease on a tilde lower bound and none on the upper bound', () => {
    expect(comparatorsOf('~1.0.0-alpha')).toEqual([
      version({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] }),
      version({ major: 1, minor: 1, patch: 0, prerelease: [] }),
    ])
  })

  const INVALID = [
    ['an empty prerelease', '1.0.0-'],
    ['an empty build', '1.0.0+'],
    ['an empty identifier between dots', '>=1.0.0-alpha..1'],
    ['a prerelease identifier with a character outside letters, digits and hyphens', '1.0.0-al$pha'],
    ['a build identifier with a character outside letters, digits and hyphens', '1.0.0+sha_1'],
    ['an empty prerelease on a hyphen range bound', '1.0.0- - 2.0.0'],
  ] as const

  for (const [what, input] of INVALID) {
    it(`rejects ${what}`, () => {
      expect(parseRange(input)).toEqual(expect.objectContaining({ success: false }))
    })
  }
})

describe('parseRange - x-range with an empty leading segment', () => {
  it('rejects a range that starts with two dots', () => {
    expect(parseRange('../x')).toEqual(expect.objectContaining({ success: false, error: 'Invalid x-range: "../x"' }))
  })

  it('rejects a range that starts with a dot', () => {
    expect(parseRange('.x')).toEqual(expect.objectContaining({ success: false }))
  })

  it('still treats an x in the leading segment as any version', () => {
    expect(parseRange('x.1')).toEqual(expect.objectContaining({ success: true, range: expect.objectContaining({ sets: [] }) }))
  })
})
