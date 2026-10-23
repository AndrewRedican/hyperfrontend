import { describe, expect, it } from '@hyperfrontend/testing'
import { splitWords } from './origin.ts'

/**
 * The words the earlier regular expression split a name into, kept to show the scan agrees with it.
 *
 * @param name - An identifier or property name
 * @returns Its words, lowercased
 */
function splitByPattern(name: string): string[] {
  return (name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z0-9]+/g) ?? []).map((word) => word.toLowerCase())
}

/** Names covering camelCase, acronyms, digits, separators and their edges. */
const NAMES = [
  '',
  'path',
  'filePath',
  'FilePath',
  'XMLHttpRequest',
  'readXMLHttp_requestPath2',
  'URL',
  'baseURL',
  'URLPath',
  'A',
  'aB',
  'AB1',
  'A1b',
  'ABCd',
  'snake_case_name',
  'kebab-case-name',
  '$root__dir',
  'out2Dir',
  'v8Coverage',
  'IOStream',
  '__dirname',
  'ÄpfelPath',
]

describe('splitWords', () => {
  it('splits camelCase', () => {
    expect(splitWords('filePath')).toEqual(['file', 'path'])
  })

  it('keeps an acronym whole and starts the next word at its last capital', () => {
    expect(splitWords('XMLHttpRequest')).toEqual(['xml', 'http', 'request'])
  })

  it('keeps a trailing acronym whole', () => {
    expect(splitWords('baseURL')).toEqual(['base', 'url'])
  })

  it('treats separators as word breaks', () => {
    expect(splitWords('$root__dir-name')).toEqual(['root', 'dir', 'name'])
  })

  it('ends an acronym before a digit', () => {
    expect(splitWords('AB1')).toEqual(['ab', '1'])
  })

  it('splits every name exactly as the regular expression it replaced', () => {
    expect(NAMES.map((name) => splitWords(name))).toEqual(NAMES.map((name) => splitByPattern(name)))
  })
})
