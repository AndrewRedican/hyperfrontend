import type { GuideIndexEntry } from '../../scripts/generate-guides.types'
import { describe, expect, it } from 'vitest'
import { searchGuides } from './guide-search'

/**
 * Build a guide index entry over the corpus defaults, so each fixture states
 * only the field the test is about.
 *
 * @param overrides - The fields this fixture cares about
 * @returns An index entry carrying every field the search reads
 */
function guide(overrides: Partial<GuideIndexEntry>): GuideIndexEntry {
  return <GuideIndexEntry>{
    slug: 'a-guide',
    route: '/docs/guides/a-guide',
    type: 'how-to',
    title: 'An untitled guide',
    problem: '',
    outcome: '',
    packages: [],
    keywords: [],
    headings: [],
    ...overrides,
  }
}

const CORPUS = [
  guide({
    slug: 'build-a-setup-wizard-for-your-cli',
    type: 'tutorial',
    title: 'Build a setup wizard for your CLI',
    packages: ['@hyperfrontend/questions'],
    problem: 'My CLI takes its setup from a wall of flags nobody remembers.',
    outcome: 'A create-service command that asks four things and writes a project.',
    keywords: ['prompt', 'scaffolding'],
    headings: ['Ask the first question', 'Validate while the reader types'],
  }),
  guide({
    slug: 'encrypt-a-string-with-a-password',
    // why: No 'how to' in the title, so the type-spelling tests can only pass through the type facet
    title: 'Encrypt and decrypt a string with a password',
    packages: ['@hyperfrontend/cryptography'],
    problem: 'Storing a secret as plain text is not an option.',
    outcome: 'Ciphertext that round-trips from a passphrase.',
    keywords: ['AES', 'passphrase'],
    headings: ['Derive a key', 'Encrypt the payload'],
  }),
]

describe('searchGuides', () => {
  it('returns the corpus untouched for a blank query', () => {
    expect(searchGuides(CORPUS, '')).toBe(CORPUS)
  })

  it('returns the corpus untouched for a query that normalizes to nothing', () => {
    expect(searchGuides(CORPUS, '!!!')).toBe(CORPUS)
  })

  it('matches a guide by its title', () => {
    expect(searchGuides(CORPUS, 'setup wizard')).toEqual([CORPUS[0]])
  })

  it('matches a guide by a package it involves, without its npm scope', () => {
    expect(searchGuides(CORPUS, 'cryptography')).toEqual([CORPUS[1]])
  })

  it('matches a guide by an authored keyword', () => {
    expect(searchGuides(CORPUS, 'passphrase')).toEqual([CORPUS[1]])
  })

  it('matches a guide by the problem it solves', () => {
    expect(searchGuides(CORPUS, 'wall of flags')).toEqual([CORPUS[0]])
  })

  it('matches a guide by the outcome it leaves the reader with', () => {
    expect(searchGuides(CORPUS, 'round trips')).toEqual([CORPUS[1]])
  })

  it('matches a guide by one of its section headings', () => {
    expect(searchGuides(CORPUS, 'derive a key')).toEqual([CORPUS[1]])
  })

  it('matches the document type spelled with a hyphen', () => {
    expect(searchGuides(CORPUS, 'how-to')).toEqual([CORPUS[1]])
  })

  it('matches the document type spelled with a space', () => {
    expect(searchGuides(CORPUS, 'how to')).toEqual([CORPUS[1]])
  })

  it('matches the document type by its plural label', () => {
    expect(searchGuides(CORPUS, 'tutorials')).toEqual([CORPUS[0]])
  })

  it('excludes a guide unless every token matches the same tier', () => {
    expect(searchGuides(CORPUS, 'wizard cryptography')).toEqual([])
  })

  it('ranks a title match above a package match', () => {
    const corpus = [
      guide({ slug: 'prompts-without-a-terminal', title: 'Test interactive prompts', packages: ['@hyperfrontend/questions'] }),
      guide({ slug: 'ask-better-questions', title: 'How to ask better questions', packages: ['@hyperfrontend/logging'] }),
    ]
    expect(searchGuides(corpus, 'questions').map((entry) => entry.slug)).toEqual(['ask-better-questions', 'prompts-without-a-terminal'])
  })

  it('keeps the order it was given between equally relevant guides', () => {
    const corpus = [
      guide({ slug: 'second-alphabetically', title: 'Encrypt a payload' }),
      guide({ slug: 'first-alphabetically', title: 'Encrypt a string' }),
    ]
    expect(searchGuides(corpus, 'encrypt').map((entry) => entry.slug)).toEqual(['second-alphabetically', 'first-alphabetically'])
  })
})
