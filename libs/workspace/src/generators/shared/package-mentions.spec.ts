import { describe, expect, it } from '@hyperfrontend/testing'
import { replacePackageMentions } from './package-mentions'

describe('replacePackageMentions', () => {
  describe('a scoped name', () => {
    it('returns a text that never mentions the package as it is', () => {
      expect(replacePackageMentions('The @acme/core-ui library', '@acme/kernel', '@acme/core')).toBe('The @acme/core-ui library')
    })

    it('returns the text as it is for an empty name', () => {
      expect(replacePackageMentions('The @acme/core library', '', '@acme/kernel')).toBe('The @acme/core library')
    })

    it('rewrites a mention that ends the text', () => {
      expect(replacePackageMentions('npm install @acme/core', '@acme/core', '@acme/kernel')).toBe('npm install @acme/kernel')
    })

    it('rewrites every mention, keeping the text between them', () => {
      expect(replacePackageMentions('# @acme/core\n\nThe @acme/core library\n', '@acme/core', '@acme/kernel')).toBe(
        '# @acme/kernel\n\nThe @acme/kernel library\n'
      )
    })

    it.each([['@acme/corelib'], ['@acme/coreUI'], ['@acme/core2']])('leaves %s, a longer name, alone', (longer) => {
      expect(replacePackageMentions(`uses ${longer} here`, '@acme/core', '@acme/kernel')).toBe(`uses ${longer} here`)
    })

    it.each([['@acme/core-ui'], ['@acme/core_x'], ['@acme/core.js'], ['@acme/core~next'], ['@acme/core-2']])(
      'leaves %s, a longer name over a joining character, alone',
      (longer) => {
        expect(replacePackageMentions(`uses ${longer} here`, '@acme/core', '@acme/kernel')).toBe(`uses ${longer} here`)
      }
    )

    it.each([
      ['a full stop ending a sentence', 'Built on @acme/core. Fast.', 'Built on @acme/kernel. Fast.'],
      ['a full stop ending the text', 'Built on @acme/core.', 'Built on @acme/kernel.'],
      ['a closing emphasis mark', 'the _@acme/core_ library', 'the _@acme/kernel_ library'],
      ['a hyphen before a space', '@acme/core - the base', '@acme/kernel - the base'],
      ['an entry of the package', "import '@acme/core/testing'", "import '@acme/kernel/testing'"],
      ['a version', 'npm install @acme/core@1.2.3', 'npm install @acme/kernel@1.2.3'],
      ['a closing backtick', 'the `@acme/core` library', 'the `@acme/kernel` library'],
      ['a comma', '@acme/core, the base', '@acme/kernel, the base'],
      ['a closing bracket', '(see @acme/core)', '(see @acme/kernel)'],
    ])('rewrites a mention followed by %s', (_what, text, expected) => {
      expect(replacePackageMentions(text, '@acme/core', '@acme/kernel')).toBe(expected)
    })

    it.each([
      ['word', 'Use @acme/core.Then read on.', 'Use @acme/kernel.Then read on.'],
      ['letter', 'Import @acme/core.A plan follows.', 'Import @acme/kernel.A plan follows.'],
    ])('rewrites a mention that a full stop and a capital %s follow without a space, as the end of a sentence', (_what, text, expected) => {
      expect(replacePackageMentions(text, '@acme/core', '@acme/kernel')).toBe(expected)
    })

    it.each([['@acme/core-Ui'], ['@acme/core_X'], ['@acme/core~Next']])(
      'leaves %s, a longer name whose next part is capitalised after another joining character, alone',
      (longer) => {
        expect(replacePackageMentions(`uses ${longer} here`, '@acme/core', '@acme/kernel')).toBe(`uses ${longer} here`)
      }
    )

    it('rewrites a mention at the end of an address, after a slash', () => {
      expect(replacePackageMentions('https://www.npmjs.com/package/@acme/core', '@acme/core', '@acme/kernel')).toBe(
        'https://www.npmjs.com/package/@acme/kernel'
      )
    })

    it.each([['svg'], ['png'], ['json'], ['md'], ['d.ts']])('rewrites a mention that the file extension .%s follows', (extension) => {
      expect(replacePackageMentions(`https://img.shields.io/npm/v/@acme/core.${extension}`, '@acme/core', '@acme/kernel')).toBe(
        `https://img.shields.io/npm/v/@acme/kernel.${extension}`
      )
    })

    it('rewrites the image and the link of a badge together', () => {
      expect(
        replacePackageMentions(
          '[![npm](https://img.shields.io/npm/v/@acme/core.svg)](https://www.npmjs.com/package/@acme/core)',
          '@acme/core',
          '@acme/kernel'
        )
      ).toBe('[![npm](https://img.shields.io/npm/v/@acme/kernel.svg)](https://www.npmjs.com/package/@acme/kernel)')
    })

    it('rewrites a mention that a file extension and a full stop follow', () => {
      expect(replacePackageMentions('The badge is @acme/core.svg.', '@acme/core', '@acme/kernel')).toBe('The badge is @acme/kernel.svg.')
    })

    it.each([['@acme/core.svgo'], ['@acme/core.md-utils'], ['@acme/core.json5']])(
      'leaves %s, a longer name that starts as a file extension does, alone',
      (longer) => {
        expect(replacePackageMentions(`uses ${longer} here`, '@acme/core', '@acme/kernel')).toBe(`uses ${longer} here`)
      }
    )

    it('rewrites the mentions alone in a text that names a longer package too', () => {
      expect(replacePackageMentions('npm install @acme/core @acme/core-ui @acme/core', '@acme/core', '@acme/kernel')).toBe(
        'npm install @acme/kernel @acme/core-ui @acme/kernel'
      )
    })

    it('leaves a mention of the new name alone when it extends the current one', () => {
      expect(replacePackageMentions('@acme/a @acme/aa @acme/a', '@acme/a', '@acme/aa')).toBe('@acme/aa @acme/aa @acme/aa')
    })
  })

  describe('a name without a scope', () => {
    it('rewrites a mention that starts the text', () => {
      expect(replacePackageMentions('core is the base', 'core', 'kernel')).toBe('kernel is the base')
    })

    it.each([
      ['a space', 'the core library', 'the kernel library'],
      ['a quote', 'require("core")', 'require("kernel")'],
      ['a backtick', 'the `core` library', 'the `kernel` library'],
    ])('rewrites a mention that follows %s', (_what, text, expected) => {
      expect(replacePackageMentions(text, 'core', 'kernel')).toBe(expected)
    })

    it.each([
      ['a letter', 'hardcore'],
      ['a digit', 'v2core'],
      ['a hyphen', 'hard-core'],
      ['an underscore', 'hard_core'],
      ['a full stop', 'lodash.core'],
      ['a tilde', 'hard~core'],
      ['a scope', '@acme/core'],
      ['an at sign', 'pkg@core'],
      ['a scope of several parts', '@my-org.x/core'],
      ['a scope in an address', 'https://www.npmjs.com/package/@acme/core'],
    ])('leaves the name alone inside a longer one, after %s', (_what, longer) => {
      expect(replacePackageMentions(`uses ${longer} here`, 'core', 'kernel')).toBe(`uses ${longer} here`)
    })

    it.each([
      ['a registry address', 'https://www.npmjs.com/package/core', 'https://www.npmjs.com/package/kernel'],
      ['the image of a badge', 'https://img.shields.io/npm/v/core.svg', 'https://img.shields.io/npm/v/kernel.svg'],
      ['an address without a protocol', 'unpkg.com/core@1', 'unpkg.com/kernel@1'],
      ['the directory of installed packages', 'node_modules/core/index.js', 'node_modules/kernel/index.js'],
      ['a directory of the same name', 'see libs/core', 'see libs/kernel'],
      ['a slash that starts the text', '/core', '/kernel'],
    ])('rewrites a mention that follows a slash outside a scope, in %s', (_what, text, expected) => {
      expect(replacePackageMentions(text, 'core', 'kernel')).toBe(expected)
    })

    it('leaves a longer name that starts with it alone', () => {
      expect(replacePackageMentions('core and core-ui', 'core', 'kernel')).toBe('kernel and core-ui')
    })

    it('rewrites a mention that a full stop and a capitalised word follow without a space', () => {
      expect(replacePackageMentions('Start with core.Then go on.', 'core', 'kernel')).toBe('Start with kernel.Then go on.')
    })
  })
})
