/**
 * The `crlf.md` document the Markdown parser specs read, and the tree the reference parser builds from it.
 *
 * @module markdown/__test-utils__/cases/crlf
 */

export const CRLF = {
  name: 'crlf.md',
  source: `one\r
two  \r
three\r
\r
\`\`\`\r
code\r
\`\`\`\r
`,
  tree: `root 1:1:0-8:1:37
  paragraph 1:1:0-3:6:17
    text 1:1:0-2:4:8 value="one\\r\\ntwo"
    break 2:4:8-3:1:12
    text 3:1:12-3:6:17 value="three"
  code 5:1:21-7:4:35 value="code"
`,
}
