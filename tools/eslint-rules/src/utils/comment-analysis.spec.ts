import type { TSESTree } from '@typescript-eslint/utils'
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  containsJsDocTag,
  isToolingDirective,
  hasAllowedHintPrefix,
  containsSectionDivider,
  isConfigFile,
  isDecorativeHeaderComment,
  getLineCommentContent,
  isTrailingComment,
  findSectionDividerBlocks,
  JSDOC_TAGS,
  TOOLING_DIRECTIVE_PATTERNS,
  ALLOWED_HINT_PREFIXES,
} from './comment-analysis'

function createMockComment(
  type: 'Line' | 'Block',
  value: string,
  range: [number, number] = [0, 10],
  loc: TSESTree.SourceLocation = {
    start: { line: 1, column: 0 },
    end: { line: 1, column: 10 },
  }
): TSESTree.Comment {
  return { type, value, range, loc } as TSESTree.Comment
}

function createMockSourceCode(text: string, lines?: string[]): SourceCode {
  return {
    getText: () => text,
    getLines: () => lines ?? text.split('\n'),
  } as unknown as SourceCode
}

describe('comment-analysis utilities', () => {
  describe('containsJsDocTag', () => {
    it('detects common JSDoc tags', () => {
      expect(containsJsDocTag('@param name The parameter')).toBe(true)
      expect(containsJsDocTag('@returns The result')).toBe(true)
      expect(containsJsDocTag('@module myModule')).toBe(true)
      expect(containsJsDocTag('@example')).toBe(true)
    })

    it('handles tags case-insensitively', () => {
      expect(containsJsDocTag('@PARAM name')).toBe(true)
      expect(containsJsDocTag('@Param name')).toBe(true)
    })

    it('rejects partial tag matches', () => {
      expect(containsJsDocTag('@parameters name')).toBe(false)
      expect(containsJsDocTag('@returning value')).toBe(false)
    })

    it('accepts tags followed by valid terminators', () => {
      expect(containsJsDocTag('@param\n')).toBe(true)
      expect(containsJsDocTag('@param ')).toBe(true)
      expect(containsJsDocTag('@param\t')).toBe(true)
      expect(containsJsDocTag('* @param')).toBe(true)
    })

    it('detects specialized tags', () => {
      expect(containsJsDocTag('@jest-environment jsdom')).toBe(true)
      expect(containsJsDocTag('@jsxImportSource react')).toBe(true)
    })

    it('returns false for plain text without tags', () => {
      expect(containsJsDocTag('This is just text')).toBe(false)
      expect(containsJsDocTag('')).toBe(false)
    })
  })

  describe('isToolingDirective', () => {
    it('detects TypeScript directives', () => {
      expect(isToolingDirective('@ts-ignore')).toBe(true)
      expect(isToolingDirective('@ts-expect-error')).toBe(true)
      expect(isToolingDirective('@ts-nocheck')).toBe(true)
      expect(isToolingDirective('@ts-check')).toBe(true)
    })

    it('detects ESLint directives', () => {
      expect(isToolingDirective('eslint-disable')).toBe(true)
      expect(isToolingDirective('eslint-disable-next-line')).toBe(true)
      expect(isToolingDirective('eslint-enable')).toBe(true)
    })

    it('detects Istanbul/coverage directives', () => {
      expect(isToolingDirective('istanbul ignore next')).toBe(true)
      expect(isToolingDirective('istanbul ignore line')).toBe(true)
      expect(isToolingDirective('c8 ignore next')).toBe(true)
    })

    it('detects bundler directives', () => {
      expect(isToolingDirective('webpackChunkName: "chunk"')).toBe(true)
      expect(isToolingDirective('@vite-ignore')).toBe(true)
    })

    it('handles leading whitespace', () => {
      expect(isToolingDirective('  @ts-ignore')).toBe(true)
      expect(isToolingDirective('\t@ts-expect-error')).toBe(true)
    })

    it('is case-insensitive', () => {
      expect(isToolingDirective('@TS-IGNORE')).toBe(true)
      expect(isToolingDirective('ESLINT-DISABLE')).toBe(true)
    })

    it('returns false for non-directives', () => {
      expect(isToolingDirective('This is a comment')).toBe(false)
      expect(isToolingDirective('')).toBe(false)
    })
  })

  describe('hasAllowedHintPrefix', () => {
    it('accepts all defined hint prefixes', () => {
      for (const prefix of ALLOWED_HINT_PREFIXES) {
        expect(hasAllowedHintPrefix(`${prefix}: some explanation`)).toBe(true)
      }
    })

    it('handles case-insensitivity', () => {
      expect(hasAllowedHintPrefix('WHY: explanation')).toBe(true)
      expect(hasAllowedHintPrefix('Why: explanation')).toBe(true)
      expect(hasAllowedHintPrefix('TODO: do this')).toBe(true)
    })

    it('handles leading whitespace', () => {
      expect(hasAllowedHintPrefix('  why: explanation')).toBe(true)
      expect(hasAllowedHintPrefix('\tnote: important')).toBe(true)
    })

    it('requires colon after prefix', () => {
      expect(hasAllowedHintPrefix('why explanation')).toBe(false)
      expect(hasAllowedHintPrefix('why-explanation')).toBe(false)
    })

    it('returns false for non-prefixed comments', () => {
      expect(hasAllowedHintPrefix('This is plain text')).toBe(false)
      expect(hasAllowedHintPrefix('')).toBe(false)
    })
  })

  describe('containsSectionDivider', () => {
    it('detects 4+ consecutive equals signs', () => {
      expect(containsSectionDivider('====')).toBe(true)
      expect(containsSectionDivider('=====')).toBe(true)
      expect(containsSectionDivider('==============================')).toBe(true)
    })

    it('detects equals in context', () => {
      expect(containsSectionDivider('// ==== Section ====')).toBe(true)
      expect(containsSectionDivider('  ====  ')).toBe(true)
    })

    it('rejects fewer than 4 equals', () => {
      expect(containsSectionDivider('===')).toBe(false)
      expect(containsSectionDivider('==')).toBe(false)
      expect(containsSectionDivider('=')).toBe(false)
    })

    it('rejects non-contiguous equals', () => {
      expect(containsSectionDivider('= = = =')).toBe(false)
      expect(containsSectionDivider('=-=')).toBe(false)
    })

    it('handles empty strings', () => {
      expect(containsSectionDivider('')).toBe(false)
    })
  })

  describe('isConfigFile', () => {
    it('identifies TypeScript config files', () => {
      expect(isConfigFile('/path/to/tsconfig.json')).toBe(true)
      expect(isConfigFile('/path/to/tsconfig.base.json')).toBe(true)
    })

    it('identifies Jest config files', () => {
      expect(isConfigFile('/path/to/jest.config.ts')).toBe(true)
      expect(isConfigFile('/path/to/jest.config.js')).toBe(true)
    })

    it('identifies ESLint config files', () => {
      expect(isConfigFile('/path/to/eslint.config.js')).toBe(true)
      expect(isConfigFile('/path/to/eslint.base.config.cjs')).toBe(true)
      expect(isConfigFile('/path/to/.eslintrc.json')).toBe(true)
    })

    it('identifies various build tool configs', () => {
      expect(isConfigFile('/path/to/vite.config.ts')).toBe(true)
      expect(isConfigFile('/path/to/webpack.config.js')).toBe(true)
      expect(isConfigFile('/path/to/rollup.config.js')).toBe(true)
    })

    it('identifies Nx/Angular configs', () => {
      expect(isConfigFile('/path/to/nx.json')).toBe(true)
      expect(isConfigFile('/path/to/project.json')).toBe(true)
      expect(isConfigFile('/path/to/angular.json')).toBe(true)
    })

    it('returns false for regular source files', () => {
      expect(isConfigFile('/path/to/component.ts')).toBe(false)
      expect(isConfigFile('/path/to/utils.js')).toBe(false)
      expect(isConfigFile('/path/to/index.tsx')).toBe(false)
    })
  })

  describe('isDecorativeHeaderComment', () => {
    it('returns false for line comments', () => {
      const comment = createMockComment('Line', ' Header comment')
      const sourceCode = createMockSourceCode('// Header comment')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when there is code before the comment', () => {
      const comment = createMockComment('Block', ' Header ', [10, 25])
      const sourceCode = createMockSourceCode('const x = 1;/* Header */')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false if comment contains JSDoc tags', () => {
      const comment = createMockComment('Block', '\n * @module MyModule\n ', [0, 30])
      const sourceCode = createMockSourceCode('/*\n * @module MyModule\n */')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false if comment contains tooling directives', () => {
      const comment = createMockComment('Block', '\n * @ts-nocheck\n ', [0, 25])
      const sourceCode = createMockSourceCode('/*\n * @ts-nocheck\n */')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false for single-line block comments', () => {
      const comment = createMockComment('Block', ' Header ')
      const sourceCode = createMockSourceCode('/* Header */')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when comment precedes export declaration', () => {
      const commentText = '\n * Nx project.json configuration types.\n '
      const fullSource = '/*\n * Nx project.json configuration types.\n */\nexport interface ProjectJsonFixture {}'
      const comment = createMockComment('Block', commentText, [0, 47])
      const sourceCode = createMockSourceCode(fullSource)
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when comment precedes interface declaration', () => {
      const commentText = '\n * Configuration options.\n '
      const fullSource = '/*\n * Configuration options.\n */\ninterface Config {}'
      const comment = createMockComment('Block', commentText, [0, 33])
      const sourceCode = createMockSourceCode(fullSource)
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when comment precedes function declaration', () => {
      const commentText = '\n * Processes the data.\n '
      const fullSource = '/*\n * Processes the data.\n */\nfunction process() {}'
      const comment = createMockComment('Block', commentText, [0, 30])
      const sourceCode = createMockSourceCode(fullSource)
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when comment precedes const declaration', () => {
      const commentText = '\n * Default configuration.\n '
      const fullSource = '/*\n * Default configuration.\n */\nconst DEFAULT = {}'
      const comment = createMockComment('Block', commentText, [0, 33])
      const sourceCode = createMockSourceCode(fullSource)
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when comment precedes class declaration', () => {
      const commentText = '\n * Base handler class.\n '
      const fullSource = '/*\n * Base handler class.\n */\nclass Handler {}'
      const comment = createMockComment('Block', commentText, [0, 30])
      const sourceCode = createMockSourceCode(fullSource)
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when comment precedes type declaration', () => {
      const commentText = '\n * User type definition.\n '
      const fullSource = '/*\n * User type definition.\n */\ntype User = { name: string }'
      const comment = createMockComment('Block', commentText, [0, 32])
      const sourceCode = createMockSourceCode(fullSource)
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(false)
    })

    it('returns true for decorative multi-line header without tags', () => {
      const comment = createMockComment('Block', '\n * My Application\n * Version 1.0\n ', [0, 45])
      // note: No declaration follows - file ends after the comment
      const sourceCode = createMockSourceCode('/*\n * My Application\n * Version 1.0\n */')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(true)
    })

    it('returns true for decorative header followed by non-declaration code', () => {
      const comment = createMockComment('Block', '\n * Application Banner\n ', [0, 30])
      // note: 'console' is not in the declaration patterns list
      const sourceCode = createMockSourceCode('/*\n * Application Banner\n */\nconsole.log("start")')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(true)
    })

    it('allows whitespace before the comment', () => {
      const comment = createMockComment('Block', '\n * Decorative Header\n * Some description\n ', [3, 50])
      const sourceCode = createMockSourceCode('   /*\n * Decorative Header\n * Some description\n */')
      expect(isDecorativeHeaderComment(comment, sourceCode)).toBe(true)
    })
  })

  describe('getLineCommentContent', () => {
    it('returns comment value for line comments', () => {
      const comment = createMockComment('Line', ' This is a comment')
      expect(getLineCommentContent(comment)).toBe(' This is a comment')
    })

    it('returns empty string for block comments', () => {
      const comment = createMockComment('Block', ' This is a block comment ')
      expect(getLineCommentContent(comment)).toBe('')
    })

    it('handles empty line comments', () => {
      const comment = createMockComment('Line', '')
      expect(getLineCommentContent(comment)).toBe('')
    })
  })

  describe('isTrailingComment', () => {
    it('returns true when code precedes comment on same line', () => {
      const comment = createMockComment('Line', ' trailing', [15, 25], {
        start: { line: 1, column: 15 },
        end: { line: 1, column: 25 },
      })
      const sourceCode = createMockSourceCode('const x = 1; // trailing', ['const x = 1; // trailing'])
      expect(isTrailingComment(comment, sourceCode)).toBe(true)
    })

    it('returns false when comment is on its own line', () => {
      const comment = createMockComment('Line', ' standalone', [0, 14], {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 14 },
      })
      const sourceCode = createMockSourceCode('// standalone', ['// standalone'])
      expect(isTrailingComment(comment, sourceCode)).toBe(false)
    })

    it('returns false when only whitespace precedes comment', () => {
      const comment = createMockComment('Line', ' indented', [4, 15], {
        start: { line: 1, column: 4 },
        end: { line: 1, column: 15 },
      })
      const sourceCode = createMockSourceCode('    // indented', ['    // indented'])
      expect(isTrailingComment(comment, sourceCode)).toBe(false)
    })

    it('handles block comments as trailing', () => {
      const comment = createMockComment('Block', ' inline ', [12, 24], {
        start: { line: 1, column: 12 },
        end: { line: 1, column: 24 },
      })
      const sourceCode = createMockSourceCode('const x = 1 /* inline */', ['const x = 1 /* inline */'])
      expect(isTrailingComment(comment, sourceCode)).toBe(true)
    })

    it('handles missing line gracefully', () => {
      const comment = createMockComment('Line', ' comment', [0, 10], {
        start: { line: 5, column: 0 },
        end: { line: 5, column: 10 },
      })
      const sourceCode = createMockSourceCode('// comment', ['// comment'])
      expect(isTrailingComment(comment, sourceCode)).toBe(false)
    })
  })

  describe('findSectionDividerBlocks', () => {
    it('returns empty array when no comments exist', () => {
      const sourceCode = createMockSourceCode('const x = 1;')
      expect(findSectionDividerBlocks([], sourceCode)).toEqual([])
    })

    it('returns empty array when no section dividers exist', () => {
      const comments = [createMockComment('Line', ' regular comment')]
      const sourceCode = createMockSourceCode('// regular comment')
      expect(findSectionDividerBlocks(comments, sourceCode)).toEqual([])
    })

    it('finds a single section divider comment', () => {
      const comment = createMockComment('Line', ' ====', [0, 7], {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 7 },
      })
      const sourceCode = createMockSourceCode('// ====\n')
      const blocks = findSectionDividerBlocks([comment], sourceCode)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]?.comments).toHaveLength(1)
    })

    it('groups consecutive divider comments', () => {
      const comments = [
        createMockComment('Line', ' ====', [0, 7], {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 7 },
        }),
        createMockComment('Line', ' Section', [8, 18], {
          start: { line: 2, column: 0 },
          end: { line: 2, column: 10 },
        }),
        createMockComment('Line', ' ====', [19, 26], {
          start: { line: 3, column: 0 },
          end: { line: 3, column: 7 },
        }),
      ]
      const sourceCode = createMockSourceCode('// ====\n// Section\n// ====\n')
      const blocks = findSectionDividerBlocks(comments, sourceCode)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]?.comments).toHaveLength(3)
    })

    it('ignores block comments', () => {
      const comments = [createMockComment('Block', ' ==== ')]
      const sourceCode = createMockSourceCode('/* ==== */')
      expect(findSectionDividerBlocks(comments, sourceCode)).toEqual([])
    })

    it('separates non-adjacent comment groups', () => {
      const comments = [
        createMockComment('Line', ' ====', [0, 7], {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 7 },
        }),
        createMockComment('Line', ' ====', [25, 32], {
          start: { line: 4, column: 0 },
          end: { line: 4, column: 7 },
        }),
      ]
      const sourceCode = createMockSourceCode('// ====\nconst x = 1;\nconst y = 2;\n// ====\n')
      const blocks = findSectionDividerBlocks(comments, sourceCode)
      expect(blocks).toHaveLength(2)
    })

    it('separates groups with different indentation', () => {
      const comments = [
        createMockComment('Line', ' ====', [0, 7], {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 7 },
        }),
        createMockComment('Line', ' ====', [8, 17], {
          start: { line: 2, column: 2 },
          end: { line: 2, column: 9 },
        }),
      ]
      const sourceCode = createMockSourceCode('// ====\n  // ====\n')
      const blocks = findSectionDividerBlocks(comments, sourceCode)
      expect(blocks).toHaveLength(2)
    })

    it('includes adjacent lines without dividers if group has one', () => {
      const comments = [
        createMockComment('Line', ' Header', [0, 9], {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 9 },
        }),
        createMockComment('Line', ' ====', [10, 17], {
          start: { line: 2, column: 0 },
          end: { line: 2, column: 7 },
        }),
      ]
      const sourceCode = createMockSourceCode('// Header\n// ====\n')
      const blocks = findSectionDividerBlocks(comments, sourceCode)
      expect(blocks).toHaveLength(1)
      expect(blocks[0]?.comments).toHaveLength(2)
    })

    it('captures correct range including newline', () => {
      const comment = createMockComment('Line', ' ====', [0, 7], {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 7 },
      })
      const sourceCode = createMockSourceCode('// ====\nconst x = 1;')
      const blocks = findSectionDividerBlocks([comment], sourceCode)
      expect(blocks[0]?.end).toBe(8)
    })
  })

  describe('constants export correctly', () => {
    it('exports JSDOC_TAGS array', () => {
      expect(Array.isArray(JSDOC_TAGS)).toBe(true)
      expect(JSDOC_TAGS.length).toBeGreaterThan(0)
      expect(JSDOC_TAGS).toContain('@param')
      expect(JSDOC_TAGS).toContain('@returns')
    })

    it('exports TOOLING_DIRECTIVE_PATTERNS array', () => {
      expect(Array.isArray(TOOLING_DIRECTIVE_PATTERNS)).toBe(true)
      expect(TOOLING_DIRECTIVE_PATTERNS.length).toBeGreaterThan(0)
      expect(TOOLING_DIRECTIVE_PATTERNS).toContain('@ts-ignore')
    })

    it('exports ALLOWED_HINT_PREFIXES array', () => {
      expect(Array.isArray(ALLOWED_HINT_PREFIXES)).toBe(true)
      expect(ALLOWED_HINT_PREFIXES).toContain('why')
      expect(ALLOWED_HINT_PREFIXES).toContain('todo')
    })
  })
})
