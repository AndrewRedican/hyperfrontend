import { escapeFilePath, escapeAuthor } from './commit'
import { escapeGitRef, escapeGitPath, escapeGitArg } from './log'
import { escapeGitMessage } from './manage-tags'
import { escapeGitTagPattern } from './query-tags'

describe('escapeGitRef', () => {
  it('allows valid refs', () => {
    expect(escapeGitRef('main')).toBe('main')
    expect(escapeGitRef('feature/add-git')).toBe('feature/add-git')
    expect(escapeGitRef('v1.0.0')).toBe('v1.0.0')
    expect(escapeGitRef('HEAD~1')).toBe('HEAD~1')
    expect(escapeGitRef('HEAD^2')).toBe('HEAD^2')
    expect(escapeGitRef('@{upstream}')).toBe('@{upstream}')
  })

  it('throws for empty ref', () => {
    expect(() => escapeGitRef('')).toThrow('Git reference is required')
  })

  it('throws for invalid characters', () => {
    expect(() => escapeGitRef('ref; rm -rf /')).toThrow('Invalid character')
    expect(() => escapeGitRef('ref`whoami`')).toThrow('Invalid character')
    expect(() => escapeGitRef('ref$HOME')).toThrow('Invalid character')
    expect(() => escapeGitRef('ref\nmalicious')).toThrow('Invalid character')
  })

  it('throws for refs exceeding max length', () => {
    const longRef = 'a'.repeat(300)
    expect(() => escapeGitRef(longRef)).toThrow('maximum length')
  })
})

describe('escapeGitPath', () => {
  it('allows valid paths', () => {
    expect(escapeGitPath('src/index.ts')).toBe('src/index.ts')
    expect(escapeGitPath('packages/lib-versioning/package.json')).toBe('packages/lib-versioning/package.json')
    expect(escapeGitPath('file with spaces.txt')).toBe('file with spaces.txt')
    expect(escapeGitPath('path/to/file-name_test.ts')).toBe('path/to/file-name_test.ts')
  })

  it('throws for empty path', () => {
    expect(() => escapeGitPath('')).toThrow('Path is required')
  })

  it('throws for invalid characters', () => {
    expect(() => escapeGitPath('path; rm -rf /')).toThrow('Invalid character')
    expect(() => escapeGitPath('path`whoami`')).toThrow('Invalid character')
    expect(() => escapeGitPath('path$(cmd)')).toThrow('Invalid character')
  })
})

describe('escapeGitArg', () => {
  it('allows valid arguments', () => {
    expect(escapeGitArg('John Doe')).toBe('John Doe')
    expect(escapeGitArg('john@example.com')).toBe('john@example.com')
    expect(escapeGitArg('Name <email@test.com>')).toBe('Name <email@test.com>')
    expect(escapeGitArg('test+suffix')).toBe('test+suffix')
  })

  it('throws for empty argument', () => {
    expect(() => escapeGitArg('')).toThrow('Argument is required')
  })

  it('throws for injection attempts', () => {
    expect(() => escapeGitArg('arg; rm -rf /')).toThrow('Invalid character')
    expect(() => escapeGitArg('arg`id`')).toThrow('Invalid character')
    expect(() => escapeGitArg('arg$(pwd)')).toThrow('Invalid character')
  })
})

describe('escapeGitTagPattern', () => {
  it('allows valid patterns', () => {
    expect(escapeGitTagPattern('v')).toBe('v')
    expect(escapeGitTagPattern('@scope/pkg@')).toBe('@scope/pkg@')
    expect(escapeGitTagPattern('release-')).toBe('release-')
    expect(escapeGitTagPattern('my_package')).toBe('my_package')
  })

  it('throws for empty pattern', () => {
    expect(() => escapeGitTagPattern('')).toThrow('Pattern is required')
  })

  it('throws for invalid characters', () => {
    expect(() => escapeGitTagPattern('v*; ls')).toThrow('Invalid character')
    expect(() => escapeGitTagPattern('tag$(id)')).toThrow('Invalid character')
  })
})

describe('escapeGitMessage', () => {
  it('allows valid messages', () => {
    expect(escapeGitMessage('feat: add new feature')).toBe('feat: add new feature')
    expect(escapeGitMessage('Multi-line\n\nmessage')).toBe('Multi-line\n\nmessage')
    expect(escapeGitMessage('Has tabs\there')).toBe('Has tabs\there')
  })

  it('escapes quotes and backslashes', () => {
    expect(escapeGitMessage('Has "quotes"')).toBe('Has \\"quotes\\"')
    expect(escapeGitMessage('Has \\backslash')).toBe('Has \\\\backslash')
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
  it('allows valid file paths', () => {
    expect(escapeFilePath('package.json')).toBe('package.json')
    expect(escapeFilePath('src/lib/index.ts')).toBe('src/lib/index.ts')
    expect(escapeFilePath('my file.txt')).toBe('my file.txt')
    expect(escapeFilePath('path-with_mixed.chars')).toBe('path-with_mixed.chars')
  })

  it('throws for empty path', () => {
    expect(() => escapeFilePath('')).toThrow('File path is required')
  })

  it('throws for injection attempts', () => {
    expect(() => escapeFilePath('; rm -rf /')).toThrow('Invalid character')
    expect(() => escapeFilePath('file`whoami`')).toThrow('Invalid character')
    expect(escapeFilePath('../../../etc/passwd')).toBe('../../../etc/passwd')
  })
})

describe('escapeAuthor', () => {
  it('allows valid author strings', () => {
    expect(escapeAuthor('John Doe')).toBe('John Doe')
    expect(escapeAuthor('John Doe <john@example.com>')).toBe('John Doe <john@example.com>')
    expect(escapeAuthor('Name-With-Dashes')).toBe('Name-With-Dashes')
  })

  it('throws for empty author', () => {
    expect(() => escapeAuthor('')).toThrow('Author is required')
  })

  it('throws for injection attempts', () => {
    expect(() => escapeAuthor('Name; rm -rf /')).toThrow('Invalid character')
    expect(() => escapeAuthor('Name`id`')).toThrow('Invalid character')
    expect(() => escapeAuthor('Name$(whoami)')).toThrow('Invalid character')
  })

  it('throws for author exceeding max length', () => {
    const longAuthor = 'a'.repeat(600)
    expect(() => escapeAuthor(longAuthor)).toThrow('maximum length')
  })
})

describe('Escape function integration', () => {
  it('handles typical version flow arguments', () => {
    expect(escapeGitRef('v1.0.0')).toBe('v1.0.0')
    expect(escapeGitRef('@hyperfrontend/versioning@1.0.0')).toBe('@hyperfrontend/versioning@1.0.0')
    expect(escapeGitRef('HEAD')).toBe('HEAD')
    expect(escapeGitRef('main')).toBe('main')
    expect(escapeGitRef('v1.0.0..HEAD')).toBe('v1.0.0..HEAD')

    expect(escapeGitPath('libs/versioning/CHANGELOG.md')).toBe('libs/versioning/CHANGELOG.md')
    expect(escapeGitPath('package.json')).toBe('package.json')

    expect(escapeGitMessage('chore(lib-versioning): release version 1.0.0')).toBe('chore(lib-versioning): release version 1.0.0')
    expect(escapeGitMessage('feat: add feature\n\nDetailed body here.')).toBe('feat: add feature\n\nDetailed body here.')

    expect(escapeAuthor('Release Bot <release@hyperfrontend.dev>')).toBe('Release Bot <release@hyperfrontend.dev>')
  })

  it('handles scoped package names correctly', () => {
    expect(escapeGitRef('@hyperfrontend/versioning@1.0.0')).toBe('@hyperfrontend/versioning@1.0.0')
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
