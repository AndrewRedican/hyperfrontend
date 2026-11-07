import { statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { sha256 } from './hashes'
import { ENVELOPE_HEAD, envelopeTail, envelopeText, writeStateFile } from './write'

const directory = useTempDir({ prefix: 'write-' })

describe('envelopeText', () => {
  it('wraps the canonical body with its digest and the schema', () => {
    expect(envelopeText({ b: 1, a: [2] })).toBe(`{"body":{"a":[2],"b":1},"digest":"${sha256('{"a":[2],"b":1}')}","schema":"hf-graph/1"}\n`)
  })

  it('is the head, the body text and the tail', () => {
    const text = envelopeText({ x: 1 })
    expect(text).toBe(`${ENVELOPE_HEAD}{"x":1}${envelopeTail(sha256('{"x":1}'))}`)
  })
})

describe('writeStateFile', () => {
  it('writes a file that is absent, creating its directory', () => {
    expect(writeStateFile(join(directory.path, 'deep', 'state.json'), 'text\n')).toBe(true)
  })

  it('leaves a file holding the same text untouched', () => {
    const path = join(directory.path, 'state.json')
    writeStateFile(path, 'text\n')
    const before = statSync(path).mtimeMs
    const written = writeStateFile(path, 'text\n')
    expect({ written, same: statSync(path).mtimeMs === before }).toEqual({ written: false, same: true })
  })

  it('rewrites a file holding other text', () => {
    const path = join(directory.path, 'state.json')
    writeStateFile(path, 'text\n')
    expect(writeStateFile(path, 'other\n')).toBe(true)
  })

  it('leaves no temporary file behind', () => {
    writeStateFile(join(directory.path, 'state.json'), 'text\n')
    expect(directory.exists(`state.json.${process.pid}.tmp`)).toBe(false)
  })
})
