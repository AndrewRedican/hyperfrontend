import type { ConfigBlock } from './model.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { effectiveConfig, isIgnored, projectConfig, selectsFile } from './resolve.ts'

const BASE: readonly ConfigBlock[] = [
  { ignores: ['dist/', '**/node_modules/'] },
  { files: ['**/*.ts'], rules: { 'no-var': 'error', 'workspace/no-enum': 'warn' }, settings: { react: { version: '19' } } },
  { files: ['**/*.spec.ts'], rules: { 'workspace/no-enum': 'off' } },
  { files: ['**/*.md'], ignores: ['docs/**'], rules: { 'workspace/codeblock-line-width': ['error', { width: 100 }] } },
]

const OWN: readonly ConfigBlock[] = [
  { files: ['**/*.ts'], rules: { 'no-var': ['warn', { allow: true }] }, settings: { jsdoc: { mode: 'typescript' } } },
]

/** A project's configuration: the base spread before its own blocks. */
const PROJECT = [...BASE, ...OWN]

describe('projectConfig', () => {
  it('keeps every block in order', () => {
    expect(projectConfig(PROJECT).blocks.map((block) => block.block)).toEqual(PROJECT)
  })

  it('collects the ignores of blocks without files as global', () => {
    expect(projectConfig(BASE).globalIgnores.map((glob) => glob.pattern)).toEqual(['dist/', '**/node_modules/'])
  })
})

describe('isIgnored', () => {
  const config = projectConfig(BASE)

  it('is true under a global ignore', () => {
    expect(isIgnored(config, 'dist/a.ts')).toBe(true)
  })

  it('is false for a file no global ignore matches', () => {
    expect(isIgnored(config, 'docs/a.md')).toBe(false)
  })
})

describe('selectsFile', () => {
  const config = projectConfig(BASE)

  it('selects a file a block names', () => {
    expect(selectsFile(config, 'src/a.ts')).toBe(true)
  })

  it('leaves a file no block names', () => {
    expect(selectsFile(config, 'src/a.js')).toBe(false)
  })

  it('leaves a globally ignored file', () => {
    expect(selectsFile(config, 'dist/a.ts')).toBe(false)
  })

  it("leaves a file a block's own ignores exclude", () => {
    expect(selectsFile(config, 'docs/a.md')).toBe(false)
  })
})

describe('effectiveConfig', () => {
  it('collects the rules of the matching blocks', () => {
    expect([...effectiveConfig(projectConfig(BASE), 'src/a.ts').rules]).toEqual([
      ['no-var', { severity: 2, options: undefined }],
      ['workspace/no-enum', { severity: 1, options: undefined }],
    ])
  })

  it('lets a later block turn a rule off', () => {
    expect([...effectiveConfig(projectConfig(BASE), 'src/a.spec.ts').rules.keys()]).toEqual(['no-var'])
  })

  it('lets a project block override a severity and give options', () => {
    expect(effectiveConfig(projectConfig(PROJECT), 'src/a.ts').rules.get('no-var')).toEqual({
      severity: 1,
      options: { allow: true },
    })
  })

  it('keeps the options of an error setting', () => {
    expect(effectiveConfig(projectConfig(BASE), 'README.md').rules.get('workspace/codeblock-line-width')).toEqual({
      severity: 2,
      options: { width: 100 },
    })
  })

  it('skips a block whose ignores match the file', () => {
    expect(effectiveConfig(projectConfig(BASE), 'docs/a.md').rules.size).toBe(0)
  })

  it('merges the settings of the matching blocks', () => {
    expect(effectiveConfig(projectConfig(PROJECT), 'src/a.ts').settings).toEqual({
      react: { version: '19' },
      jsdoc: { mode: 'typescript' },
    })
  })

  it('reads a file as a module seeing no extra globals when no block says otherwise', () => {
    expect(effectiveConfig(projectConfig(PROJECT), 'src/a.ts').language).toEqual({
      sourceType: 'module',
      globals: {},
      jsxPragma: 'React',
      jsxFragmentName: null,
    })
  })

  it('merges the language of the matching blocks, later globals over earlier ones', () => {
    const config: readonly ConfigBlock[] = [
      { files: ['**/*.js'], language: { sourceType: 'script', globals: { window: 'readonly', onload: 'writable' } } },
      { files: ['**/*.js'], language: { globals: { window: 'writable' }, jsxPragma: null } },
    ]
    expect(effectiveConfig(projectConfig(config), 'src/a.js').language).toEqual({
      sourceType: 'script',
      globals: { window: 'writable', onload: 'writable' },
      jsxPragma: null,
      jsxFragmentName: null,
    })
  })
})
