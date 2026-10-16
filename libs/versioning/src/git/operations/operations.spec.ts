import { describe, expect, it } from '@hyperfrontend/testing'
import { escapeFilePath, escapeAuthor } from './commit'
import { escapeGitRef, escapeGitPath, escapeGitArg } from './log'
import { escapeGitMessage } from './manage-tags'
import { escapeGitTagPattern } from './query-tags'

describe('escapeGitRef', () => {
  it.each(['main', 'feature/add-git', 'v1.0.0', 'HEAD~1', 'HEAD^2', '@{upstream}'])('allows the valid ref %p', (ref) => {
    expect(escapeGitRef(ref)).toBe(ref)
  })

  it('throws for empty ref', () => {
    expect(() => escapeGitRef('')).toThrow('Git reference is required')
  })

  it.each(['ref; rm -rf /', 'ref`whoami`', 'ref$HOME', 'ref\nmalicious'])('throws for the invalid character in %p', (ref) => {
    expect(() => escapeGitRef(ref)).toThrow('Invalid character')
  })

  it('throws for refs exceeding max length', () => {
    const longRef = 'a'.repeat(300)
    expect(() => escapeGitRef(longRef)).toThrow('maximum length')
  })
})

describe('escapeGitPath', () => {
  it.each(['src/index.ts', 'packages/lib-versioning/package.json', 'file with spaces.txt', 'path/to/file-name_test.ts'])(
    'allows the valid path %p',
    (path) => {
      expect(escapeGitPath(path)).toBe(path)
    }
  )

  it('throws for empty path', () => {
    expect(() => escapeGitPath('')).toThrow('Path is required')
  })

  it.each(['path; rm -rf /', 'path`whoami`', 'path$(cmd)'])('throws for the invalid character in %p', (path) => {
    expect(() => escapeGitPath(path)).toThrow('Invalid character')
  })
})

describe('escapeGitArg', () => {
  it.each(['John Doe', 'john@example.com', 'Name <email@test.com>', 'test+suffix'])('allows the valid argument %p', (arg) => {
    expect(escapeGitArg(arg)).toBe(arg)
  })

  it('throws for empty argument', () => {
    expect(() => escapeGitArg('')).toThrow('Argument is required')
  })

  it.each(['arg; rm -rf /', 'arg`id`', 'arg$(pwd)'])('throws for the injection attempt %p', (arg) => {
    expect(() => escapeGitArg(arg)).toThrow('Invalid character')
  })
})

describe('escapeGitTagPattern', () => {
  it.each(['v', '@scope/pkg@', 'release-', 'my_package'])('allows the valid pattern %p', (pattern) => {
    expect(escapeGitTagPattern(pattern)).toBe(pattern)
  })

  it('throws for empty pattern', () => {
    expect(() => escapeGitTagPattern('')).toThrow('Pattern is required')
  })

  it.each(['v*; ls', 'tag$(id)'])('throws for the invalid character in %p', (pattern) => {
    expect(() => escapeGitTagPattern(pattern)).toThrow('Invalid character')
  })
})

describe('escapeGitMessage', () => {
  it.each(['feat: add new feature', 'Multi-line\n\nmessage', 'Has tabs\there'])('allows the valid message %p', (message) => {
    expect(escapeGitMessage(message)).toBe(message)
  })

  it.each([
    ['Has "quotes"', 'Has \\"quotes\\"'],
    ['Has \\backslash', 'Has \\\\backslash'],
  ])('escapes the quotes and backslashes in %p', (message, escaped) => {
    expect(escapeGitMessage(message)).toBe(escaped)
  })

  it('throws for empty message', () => {
    expect(() => escapeGitMessage('')).toThrow('Message is required')
  })

  it('throws for message exceeding max length', () => {
    const longMessage = 'a'.repeat(15000)
    expect(() => escapeGitMessage(longMessage)).toThrow('maximum length')
  })
})

describe('escapeFilePath', () => {
  it.each(['package.json', 'src/lib/index.ts', 'my file.txt', 'path-with_mixed.chars'])('allows the valid file path %p', (path) => {
    expect(escapeFilePath(path)).toBe(path)
  })

  it('throws for empty path', () => {
    expect(() => escapeFilePath('')).toThrow('File path is required')
  })

  it.each(['; rm -rf /', 'file`whoami`'])('throws for the injection attempt %p', (path) => {
    expect(() => escapeFilePath(path)).toThrow('Invalid character')
  })

  it('allows parent-directory segments without rejecting them as an injection', () => {
    expect(escapeFilePath('../../../etc/passwd')).toBe('../../../etc/passwd')
  })
})

describe('escapeAuthor', () => {
  it.each(['John Doe', 'John Doe <john@example.com>', 'Name-With-Dashes'])('allows the valid author %p', (author) => {
    expect(escapeAuthor(author)).toBe(author)
  })

  it('throws for empty author', () => {
    expect(() => escapeAuthor('')).toThrow('Author is required')
  })

  it.each(['Name; rm -rf /', 'Name`id`', 'Name$(whoami)'])('throws for the injection attempt %p', (author) => {
    expect(() => escapeAuthor(author)).toThrow('Invalid character')
  })

  it('throws for author exceeding max length', () => {
    const longAuthor = 'a'.repeat(600)
    expect(() => escapeAuthor(longAuthor)).toThrow('maximum length')
  })
})

describe('Escape function integration', () => {
  it.each([
    ['v1.0.0', 'escapeGitRef', escapeGitRef],
    ['@hyperfrontend/versioning@1.0.0', 'escapeGitRef', escapeGitRef],
    ['HEAD', 'escapeGitRef', escapeGitRef],
    ['main', 'escapeGitRef', escapeGitRef],
    ['v1.0.0..HEAD', 'escapeGitRef', escapeGitRef],
    ['libs/versioning/CHANGELOG.md', 'escapeGitPath', escapeGitPath],
    ['package.json', 'escapeGitPath', escapeGitPath],
    ['chore(lib-versioning): release version 1.0.0', 'escapeGitMessage', escapeGitMessage],
    ['feat: add feature\n\nDetailed body here.', 'escapeGitMessage', escapeGitMessage],
    ['Release Bot <release@hyperfrontend.dev>', 'escapeAuthor', escapeAuthor],
  ])('passes the typical version flow argument %p through %s unchanged', (value, _name, escape) => {
    expect(escape(value)).toBe(value)
  })

  it('passes a scoped package tag through escapeGitRef unchanged', () => {
    expect(escapeGitRef('@hyperfrontend/versioning@1.0.0')).toBe('@hyperfrontend/versioning@1.0.0')
  })

  it('passes a scoped package prefix through escapeGitTagPattern unchanged', () => {
    expect(escapeGitTagPattern('@hyperfrontend/')).toBe('@hyperfrontend/')
  })

  it('handles conventional commit subjects', () => {
    const subjects = [
      'feat: add new feature',
      'fix: resolve bug',
      'feat(scope): scoped feature',
      'fix(scope)!: breaking fix',
      'chore: routine maintenance',
      'docs: update readme',
      'refactor: clean up code',
      'test: add tests',
      'ci: update workflow',
      'build: update deps',
    ]

    for (const subject of subjects) {
      expect(escapeGitMessage(subject)).toBe(subject)
    }
  })
})
