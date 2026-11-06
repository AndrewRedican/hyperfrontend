import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { sha256 } from './hashes'
import { readStateFile } from './read'
import { envelopeText, writeStateFile } from './write'

const directory = useTempDir({ prefix: 'read-' })

describe('readStateFile', () => {
  it('answers the body of a file as written', () => {
    const path = join(directory.path, 'state.json')
    writeStateFile(path, envelopeText({ files: [1, 2] }))
    expect(readStateFile(path)).toEqual({ files: [1, 2] })
  })

  it.each([
    ['is absent', null],
    ['does not parse', '{"body":'],
    ['follows another schema', '{"body":{},"digest":"x","schema":"other"}\n'],
    ['is null', 'null\n'],
    ['carries no digest', '{"body":{},"schema":"hf-graph/1"}\n'],
    ['carries no body', '{"digest":"x","schema":"hf-graph/1"}\n'],
    ['is not laid out as written', ` {"body":{},"digest":"${sha256('{}')}","schema":"hf-graph/1"}\n`],
    ['does not match its digest', `{"body":{"a":1},"digest":"${sha256('{}')}","schema":"hf-graph/1"}\n`],
  ])('answers nothing for a file that %s', (_case, text) => {
    const path = join(directory.path, 'state.json')
    if (text !== null) writeFileSync(path, text)
    expect(readStateFile(path)).toBeNull()
  })
})
