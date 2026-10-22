import { existsSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { createMarkdownWorkspace } from './__fixtures__/markdown-workspace.ts'
import rule from './no-manual-table-of-contents.ts'

const workspace = createMarkdownWorkspace()
const LIBRARY = workspace.libraryFile('ARCHITECTURE.md')

const message = (heading: string): string =>
  `Manual table-of-contents sections are not allowed in library markdown. The documentation site generates on-page navigation from the headings, so this "${heading}" section is redundant: remove the heading and the list under it rather than disabling this rule or hiding the section in the renderer.`

testRule(rule, {
  valid: [
    {
      name: 'technical headings',
      path: LIBRARY,
      text: '## Index Signatures\n\n## Content Security Policy\n\n## Indexing\n\n## Contents of the envelope\n',
    },
    {
      name: 'prose, a list item and a code block mentioning the words',
      path: LIBRARY,
      text: '# Title\n\nSee the table of contents above. The index is rebuilt nightly.\n\n- Contents\n\n```md\n## Contents\n```\n',
    },
    { name: 'an application', path: workspace.appFile('README.md'), text: '## Table of Contents\n' },
    { name: 'the workspace root', path: workspace.rootFile('README.md'), text: '## Table of Contents\n' },
    { name: 'a file outside any workspace', path: '/definitely/not/a/workspace/libs/x/README.md', text: '## Table of Contents\n' },
  ],
  invalid: [
    {
      name: 'index headings at any level, each named',
      path: LIBRARY,
      text: '# Title\n\n## Table of Contents\n\n1. [A](#a)\n\n### Index\n\n#### Contents\n\n## A\n',
      errors: [
        { message: message('Table of Contents'), line: 3, column: 1, endLine: 3, endColumn: 21 },
        { message: message('Index'), line: 7, column: 1, endLine: 7, endColumn: 10 },
        { message: message('Contents'), line: 9, column: 1, endLine: 9, endColumn: 14 },
      ],
    },
    {
      name: 'the permutations authors write, with decoration and spacing',
      path: LIBRARY,
      text: '## TABLE OF CONTENTS\n\n## Table Of Content\n\n## Contents:\n\n## TOC\n\n## Document Index\n\n## In this guide\n\n##   Table   of  Contents  \n',
      errors: [
        { message: message('TABLE OF CONTENTS'), line: 1, column: 1, endLine: 1, endColumn: 21 },
        { message: message('Table Of Content'), line: 3, column: 1, endLine: 3, endColumn: 20 },
        { message: message('Contents:'), line: 5, column: 1, endLine: 5, endColumn: 13 },
        { message: message('TOC'), line: 7, column: 1, endLine: 7, endColumn: 7 },
        { message: message('Document Index'), line: 9, column: 1, endLine: 9, endColumn: 18 },
        { message: message('In this guide'), line: 11, column: 1, endLine: 11, endColumn: 17 },
        { message: message('Table   of  Contents'), line: 13, column: 1, endLine: 13, endColumn: 28 },
      ],
    },
    {
      name: 'a heading whose text carries inline markup',
      path: workspace.nestedFile('README.md'),
      text: '## Table of *Contents*\n',
      errors: [{ message: message('Table of Contents'), line: 1, column: 1, endLine: 1, endColumn: 23 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
