import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { scrubLiterals } from './scrub'

describe('scrubLiterals', () => {
  it('leaves ordinary code untouched', () => {
    assert.equal(scrubLiterals('const a = 1'), 'const a = 1')
  })

  it('blanks the inside of a single-quoted string', () => {
    assert.equal(scrubLiterals("const a = 'hi'"), "const a = '  '")
  })

  it('blanks the inside of a double-quoted string', () => {
    assert.equal(scrubLiterals('const a = "hi"'), 'const a = "  "')
  })

  it('blanks the inside of a template literal', () => {
    assert.equal(scrubLiterals('const a = `hi`'), 'const a = `  `')
  })

  it('blanks an interpolation inside a template literal', () => {
    assert.equal(scrubLiterals('const a = `${b}`'), 'const a = `    `')
  })

  it('keeps an escaped quote from ending the string', () => {
    assert.equal(scrubLiterals("const a = 'a\\'b'"), "const a = '    '")
  })

  it('blanks a line comment', () => {
    assert.equal(scrubLiterals('const a = 1 // note'), 'const a = 1        ')
  })

  it('blanks a block comment', () => {
    assert.equal(scrubLiterals('const /* note */ a = 1'), 'const            a = 1')
  })

  it('preserves newlines so line numbers survive', () => {
    assert.equal(scrubLiterals('a\n`x\ny`\nb'), 'a\n` \n `\nb')
  })

  it('preserves the length of the source', () => {
    const source = "const a = 'hello' // trailing\nconst b = `x${y}z`\n/* block */"
    assert.equal(scrubLiterals(source).length, source.length)
  })

  it('ends an unterminated string at the newline', () => {
    assert.equal(scrubLiterals("const a = 'oops\nconst b = 2"), "const a = '    \nconst b = 2")
  })

  it('runs an unterminated template to the end of the source', () => {
    assert.equal(scrubLiterals('const a = `oops'), 'const a = `    ')
  })

  it('runs an unterminated block comment to the end of the source', () => {
    assert.equal(scrubLiterals('a /* oops'), 'a        ')
  })

  it('runs a line comment to the end of the source when the file has no trailing newline', () => {
    assert.equal(scrubLiterals('a // oops'), 'a        ')
  })

  it('does not treat a quote inside a comment as opening a string', () => {
    assert.equal(scrubLiterals("// it's fine\nconst a = 1"), '            \nconst a = 1')
  })
})
