import { describe, expect, it } from '@hyperfrontend/testing'
import { buildMarkerBlock, insertFeatureImport } from './insert-marker'

const SPECIFIER = './hyperfrontend.feature'
const IMPORT_LINE = "import './hyperfrontend.feature'"
const BEGIN_LINE = '// <hf:feature> — managed by @hyperfrontend/features; safe to keep'
const END_LINE = '// </hf:feature>'

describe('buildMarkerBlock', () => {
  it('wraps the glue import in the managed marker comments', () => {
    expect(buildMarkerBlock(SPECIFIER)).toEqual(expect.stringContaining(IMPORT_LINE))
  })
})

describe('insertFeatureImport', () => {
  describe('fresh insertion', () => {
    it('prepends the marker block to an unmarked entry file', () => {
      expect(insertFeatureImport('const x = 1\n', SPECIFIER)).toEqual({
        content: expect.stringContaining('const x = 1'),
        changed: true,
      })
    })

    it('starts an unmarked prologue-free entry with the begin marker', () => {
      expect(insertFeatureImport('const x = 1\n', SPECIFIER).content.startsWith(BEGIN_LINE)).toBe(true)
    })

    it('wires an entry whose comment merely mentions the marker token', () => {
      const source = '// docs: keep the <hf:feature> block below\nconst x = 1\n'
      expect(insertFeatureImport(source, SPECIFIER).changed).toBe(true)
    })

    it('wires an entry whose code line has a trailing marker-token mention', () => {
      const source = 'const a = 1 // see the <hf:feature> marker docs\n'
      expect(insertFeatureImport(source, SPECIFIER)).toEqual({ content: expect.stringContaining(IMPORT_LINE), changed: true })
    })

    it('keeps a shebang on the first line', () => {
      const { content } = insertFeatureImport('#!/usr/bin/env node\nconst x = 1\n', SPECIFIER)
      expect(content.split('\n')[0]).toBe('#!/usr/bin/env node')
    })

    it('inserts the block directly below a shebang', () => {
      const { content } = insertFeatureImport('#!/usr/bin/env node\nconst x = 1\n', SPECIFIER)
      expect(content.split('\n')[1]).toBe(BEGIN_LINE)
    })

    it("keeps a 'use client' directive above the block", () => {
      const { content } = insertFeatureImport("'use client'\n\nexport const a = 1\n", SPECIFIER)
      expect(content.indexOf("'use client'")).toBeLessThan(content.indexOf('<hf:feature>'))
    })

    it('keeps a double-quoted directive above the block', () => {
      const { content } = insertFeatureImport('"use strict";\nconst a = 1\n', SPECIFIER)
      expect(content.indexOf('"use strict"')).toBeLessThan(content.indexOf('<hf:feature>'))
    })

    it('inserts below both a shebang and a directive prologue', () => {
      const { content } = insertFeatureImport("#!/usr/bin/env node\n'use strict'\nconst a = 1\n", SPECIFIER)
      expect(content.split('\n').slice(0, 3)).toEqual(['#!/usr/bin/env node', "'use strict'", BEGIN_LINE])
    })

    it('keeps a directive below a leading line comment above the block', () => {
      const { content } = insertFeatureImport("// header\n'use client'\nconst a = 1\n", SPECIFIER)
      expect(content.indexOf("'use client'")).toBeLessThan(content.indexOf('<hf:feature>'))
    })

    it('keeps a directive below a multi-line block comment above the block', () => {
      const { content } = insertFeatureImport("/* license\n middle line\n text */\n'use strict'\nconst a = 1\n", SPECIFIER)
      expect(content.indexOf("'use strict'")).toBeLessThan(content.indexOf('<hf:feature>'))
    })

    it('keeps a directive below a single-line block comment above the block', () => {
      const { content } = insertFeatureImport("/* c */\n'use client'\nconst a = 1\n", SPECIFIER)
      expect(content.indexOf("'use client'")).toBeLessThan(content.indexOf('<hf:feature>'))
    })

    it('skips blank lines when locating the directive prologue', () => {
      const { content } = insertFeatureImport("\n'use strict'\nconst a = 1\n", SPECIFIER)
      expect(content.indexOf("'use strict'")).toBeLessThan(content.indexOf('<hf:feature>'))
    })

    it('inserts at the top when leading comments carry no directive', () => {
      const { content } = insertFeatureImport('// just a comment\nconst a = 1\n', SPECIFIER)
      expect(content.startsWith(BEGIN_LINE)).toBe(true)
    })
  })

  describe('existing block maintenance', () => {
    it('leaves a canonical block untouched', () => {
      const source = `${BEGIN_LINE}\n${IMPORT_LINE}\n${END_LINE}\n\nconst y = 2\n`
      expect(insertFeatureImport(source, SPECIFIER)).toEqual({ content: source, changed: false })
    })

    it('recognizes a bare begin marker line without the managed prose', () => {
      const source = `// <hf:feature>\n${IMPORT_LINE}\n${END_LINE}\nconst y = 2\n`
      expect(insertFeatureImport(source, SPECIFIER)).toEqual({ content: source, changed: false })
    })

    it('regenerates a stale import between the markers', () => {
      const source = `${BEGIN_LINE}\nimport './old-glue'\n${END_LINE}\nconst y = 2\n`
      expect(insertFeatureImport(source, SPECIFIER)).toEqual({
        content: `${BEGIN_LINE}\n${IMPORT_LINE}\n${END_LINE}\nconst y = 2\n`,
        changed: true,
      })
    })

    it('collapses a multi-line interior to the single managed import', () => {
      const source = `${BEGIN_LINE}\nimport './old-glue'\nconst stray = 1\n${END_LINE}\nconst y = 2\n`
      expect(insertFeatureImport(source, SPECIFIER).content).toBe(`${BEGIN_LINE}\n${IMPORT_LINE}\n${END_LINE}\nconst y = 2\n`)
    })

    it('never duplicates the block when regenerating', () => {
      const source = `${BEGIN_LINE}\nimport './old-glue'\n${END_LINE}\nconst y = 2\n`
      expect(insertFeatureImport(source, SPECIFIER).content.split('<hf:feature>')).toHaveLength(2)
    })
  })

  describe('deterministic repair', () => {
    it('restores a lost end marker below the managed import', () => {
      const source = `${BEGIN_LINE}\n${IMPORT_LINE}\nconst y = 2\n`
      expect(insertFeatureImport(source, SPECIFIER)).toEqual({
        content: `${BEGIN_LINE}\n${IMPORT_LINE}\n${END_LINE}\nconst y = 2\n`,
        changed: true,
      })
    })

    it('restores a lost begin marker above the managed import', () => {
      const source = `${IMPORT_LINE}\n${END_LINE}\nconst y = 2\n`
      expect(insertFeatureImport(source, SPECIFIER)).toEqual({
        content: `${BEGIN_LINE}\n${IMPORT_LINE}\n${END_LINE}\nconst y = 2\n`,
        changed: true,
      })
    })
  })

  describe('corrupted blocks', () => {
    it('rejects a begin marker whose next line is not the managed import', () => {
      const source = `${BEGIN_LINE}\nconst y = 2\n`
      expect(() => insertFeatureImport(source, SPECIFIER)).toThrow(
        `found a '// <hf:feature>' begin marker without a matching '${END_LINE}' end marker — add a '${END_LINE}' line directly after the managed glue import, or delete the begin marker line, then re-run.`
      )
    })

    it('rejects a begin marker on the final line', () => {
      expect(() => insertFeatureImport('const y = 2\n// <hf:feature>', SPECIFIER)).toThrow('without a matching')
    })

    it('rejects an end marker whose previous line is not the managed import', () => {
      const source = `const y = 2\n${END_LINE}\n`
      expect(() => insertFeatureImport(source, SPECIFIER)).toThrow(
        `found a '${END_LINE}' end marker without a matching '// <hf:feature>' begin marker — add a '// <hf:feature>' begin marker line directly above the managed glue import, or delete the end marker line, then re-run.`
      )
    })

    it('rejects an end marker on the first line', () => {
      expect(() => insertFeatureImport(`${END_LINE}\nconst y = 2\n`, SPECIFIER)).toThrow('without a matching')
    })

    it('rejects an end marker placed before the begin marker', () => {
      const source = `${END_LINE}\n${IMPORT_LINE}\n${BEGIN_LINE}\nconst y = 2\n`
      expect(() => insertFeatureImport(source, SPECIFIER)).toThrow('reorder the two marker lines so the begin marker comes first')
    })

    it('rejects duplicate begin markers', () => {
      const source = `${BEGIN_LINE}\n${IMPORT_LINE}\n${END_LINE}\n${BEGIN_LINE}\nconst y = 2\n`
      expect(() => insertFeatureImport(source, SPECIFIER)).toThrow('keep exactly one begin/end marker pair')
    })

    it('rejects duplicate end markers', () => {
      const source = `${BEGIN_LINE}\n${IMPORT_LINE}\n${END_LINE}\n${END_LINE}\nconst y = 2\n`
      expect(() => insertFeatureImport(source, SPECIFIER)).toThrow('keep exactly one begin/end marker pair')
    })
  })
})
