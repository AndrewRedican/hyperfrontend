/**
 * The `comment-only.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/comment-only
 */

export const COMMENT_ONLY = {
  name: 'comment-only.ts',
  source: `// nothing here
/* at all */
`,
  tree: `Program 29-29 sourceType="module"
`,
}
