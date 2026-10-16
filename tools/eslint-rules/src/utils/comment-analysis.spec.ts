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
    getLines: () => lines ?? text.split(/\r?\n/),
  } as unknown as SourceCode
}

describe('comment-analysis utilities', () => {
  describe('containsJsDocTag', () => {
    it.each(['@param name The parameter', '@returns The result', '@module myModule', '@example'])(
      'detects the common JSDoc tag in %p',
      (text: string) => {
        expect(containsJsDocTag(text)).toBe(true)
      }
    )

    it.each(['@PARAM name', '@Param name'])('detects the tag in %p regardless of case', (text: string) => {
      expect(containsJsDocTag(text)).toBe(true)
    })

    it.each(['@parameters name', '@returning value'])('rejects the partial tag match in %p', (text: string) => {
      expect(containsJsDocTag(text)).toBe(false)
    })

    it.each(['@param\n', '@param ', '@param\t', '* @param'])('accepts the tag terminator in %p', (text: string) => {
      expect(containsJsDocTag(text)).toBe(true)
    })

    it.each(['@vitest-environment jsdom', '@jsxImportSource react'])('detects the specialized tag in %p', (text: string) => {
      expect(containsJsDocTag(text)).toBe(true)
    })

    it.each(['This is just text', ''])('returns false for the tagless text %p', (text: string) => {
      expect(containsJsDocTag(text)).toBe(false)
    })
  })

  describe('isToolingDirective', () => {
    it.each(['@ts-ignore', '@ts-expect-error', '@ts-nocheck', '@ts-check'])('detects the TypeScript directive %s', (text: string) => {
      expect(isToolingDirective(text)).toBe(true)
    })

    it.each(['eslint-disable', 'eslint-disable-next-line', 'eslint-enable'])('detects the ESLint directive %s', (text: string) => {
      expect(isToolingDirective(text)).toBe(true)
    })

    it.each(['istanbul ignore next', 'istanbul ignore line', 'c8 ignore next'])('detects the coverage directive %s', (text: string) => {
      expect(isToolingDirective(text)).toBe(true)
    })

    it.each(['webpackChunkName: "chunk"', '@vite-ignore'])('detects the bundler directive %s', (text: string) => {
      expect(isToolingDirective(text)).toBe(true)
    })

    it('detects TypeScript triple-slash references', () => {
      expect(isToolingDirective('/ <reference types="vite/client" />')).toBe(true)
    })

    it('detects the managed-block markers the features CLI writes', () => {
      expect(isToolingDirective(' <hf:feature> — managed by @hyperfrontend/features; safe to keep')).toBe(true)
    })

    it('detects the closing managed-block marker', () => {
      expect(isToolingDirective(' </hf:feature>')).toBe(true)
    })

    it.each(['  @ts-ignore', '\t@ts-expect-error'])('detects the directive behind the leading whitespace in %p', (text: string) => {
      expect(isToolingDirective(text)).toBe(true)
    })

    it.each(['@TS-IGNORE', 'ESLINT-DISABLE'])('detects the directive %s regardless of case', (text: string) => {
      expect(isToolingDirective(text)).toBe(true)
    })

    it.each(['This is a comment', ''])('returns false for the non-directive %p', (text: string) => {
      expect(isToolingDirective(text)).toBe(false)
    })
  })

  describe('hasAllowedHintPrefix', () => {
    it('accepts all defined hint prefixes', () => {
      for (const prefix of ALLOWED_HINT_PREFIXES) {
        expect(hasAllowedHintPrefix(`${prefix}: some explanation`)).toBe(true)
      }
    })

    it.each(['WHY: explanation', 'Why: explanation', 'TODO: do this'])('accepts the prefix in %p regardless of case', (text: string) => {
      expect(hasAllowedHintPrefix(text)).toBe(true)
    })

    it.each(['  why: explanation', '\tnote: important'])('accepts the prefix behind the leading whitespace in %p', (text: string) => {
      expect(hasAllowedHintPrefix(text)).toBe(true)
    })

    it.each(['why explanation', 'why-explanation'])('rejects %p, whose prefix lacks a colon', (text: string) => {
      expect(hasAllowedHintPrefix(text)).toBe(false)
    })

    it.each(['This is plain text', ''])('returns false for the unprefixed comment %p', (text: string) => {
      expect(hasAllowedHintPrefix(text)).toBe(false)
    })
  })

  describe('containsSectionDivider', () => {
    it.each(['====', '=====', '=============================='])('detects the run of four or more equals signs in %p', (text: string) => {
      expect(containsSectionDivider(text)).toBe(true)
    })

    it.each(['// ==== Section ====', '  ====  '])('detects the equals signs in the context of %p', (text: string) => {
      expect(containsSectionDivider(text)).toBe(true)
    })

    it.each(['===', '==', '='])('rejects %p, which has fewer than four equals signs', (text: string) => {
      expect(containsSectionDivider(text)).toBe(false)
    })

    it.each(['= = = =', '=-='])('rejects the non-contiguous equals signs in %p', (text: string) => {
      expect(containsSectionDivider(text)).toBe(false)
    })

    it('handles empty strings', () => {
      expect(containsSectionDivider('')).toBe(false)
    })
  })

  describe('isConfigFile', () => {
    it.each(['/path/to/tsconfig.json', '/path/to/tsconfig.base.json'])('identifies the TypeScript config file %s', (path: string) => {
      expect(isConfigFile(path)).toBe(true)
    })

    it.each(['/path/to/jest.config.ts', '/path/to/jest.config.js'])('identifies the Jest config file %s', (path: string) => {
      expect(isConfigFile(path)).toBe(true)
    })

    it.each(['/path/to/eslint.config.js', '/path/to/eslint.base.config.cjs', '/path/to/.eslintrc.json'])(
      'identifies the ESLint config file %s',
      (path: string) => {
        expect(isConfigFile(path)).toBe(true)
      }
    )

    it.each(['/path/to/vite.config.ts', '/path/to/webpack.config.js', '/path/to/rollup.config.js'])(
      'identifies the build tool config file %s',
      (path: string) => {
        expect(isConfigFile(path)).toBe(true)
      }
    )

    it.each(['/path/to/nx.json', '/path/to/project.json', '/path/to/angular.json'])(
      'identifies the Nx or Angular config file %s',
      (path: string) => {
        expect(isConfigFile(path)).toBe(true)
      }
    )

    it.each(['/path/to/component.ts', '/path/to/utils.js', '/path/to/index.tsx'])(
      'returns false for the regular source file %s',
      (path: string) => {
        expect(isConfigFile(path)).toBe(false)
      }
    )
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
      expect(findSectionDividerBlocks([comment], sourceCode)).toEqual([expect.objectContaining({ comments: [comment] })])
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
      expect(findSectionDividerBlocks(comments, sourceCode)).toEqual([expect.objectContaining({ comments })])
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
      expect(findSectionDividerBlocks(comments, sourceCode)).toEqual([expect.objectContaining({ comments })])
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
    it('exports the JSDOC_TAGS array with the core documentation tags', () => {
      expect(JSDOC_TAGS).toEqual(expect.arrayContaining(['@param', '@returns']))
    })

    it('exports the TOOLING_DIRECTIVE_PATTERNS array with the TypeScript suppression directive', () => {
      expect(TOOLING_DIRECTIVE_PATTERNS).toEqual(expect.arrayContaining(['@ts-ignore']))
    })

    it('exports the ALLOWED_HINT_PREFIXES array with the why and todo prefixes', () => {
      expect(ALLOWED_HINT_PREFIXES).toEqual(expect.arrayContaining(['why', 'todo']))
    })
  })
})
