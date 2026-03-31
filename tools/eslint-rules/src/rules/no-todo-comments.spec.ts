/* eslint-disable workspace/no-todo-comments */
import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './no-todo-comments'

type TestOptions = readonly []
type MessageIds = 'noTodoComment'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - comments that do not contain standalone TODO markers
 */
const validCases: ValidTestCase<TestOptions>[] = [
  // Regular comments without todo
  {
    code: `// This is a regular comment`,
  },
  {
    code: `/* Block comment without markers */`,
  },
  {
    code: `/** JSDoc comment without markers */`,
  },
  // Naturally occurring "to-do" in hyphenated compound (path-to-document)
  {
    code: `// See path-to-document for details`,
  },
  {
    code: `/* Check path-to-document */`,
  },
  {
    code: `/** @see path-to-document */`,
  },
  // "auto download" — "to" is end of "auto", "do" is start of "download"
  {
    code: `// Prevent auto download of files`,
  },
  {
    code: `/* auto download security risk */`,
  },
  // Hyphenated compounds where "to-do" is embedded
  {
    code: `// See auto-download feature`,
  },
  {
    code: `// Use the how-to-do-it guide`,
  },
  // "todo" as part of a larger word (e.g., variable name reference)
  {
    code: `// The todoItem variable`,
  },
  {
    code: `// See factoid for more`,
  },
  // Hyphenated name containing "todo"
  {
    code: `// The todo-app package`,
  },
  {
    code: `// See react-todo-list`,
  },
  // No comments at all
  {
    code: `const x = 1`,
  },
  // Comments with similar but unrelated words
  {
    code: `// protocol documentation`,
  },
  {
    code: `// The platoon does this`,
  },
]

/**
 * Invalid test cases - comments containing standalone TODO markers
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  // Line comment: "todo"
  {
    code: `// todo fix this`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Line comment: "TODO" (uppercase)
  {
    code: `// TODO fix this`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Line comment: "Todo" (capitalized)
  {
    code: `// Todo: fix this later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Line comment: "ToDo" (camelCase)
  {
    code: `// ToDo: refactor`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Block comment: "TODO"
  {
    code: `/* TODO: implement this */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // JSDoc comment: "TODO"
  {
    code: `/** TODO: add return type */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // JSDoc @todo tag
  {
    code: `/** @todo fix the implementation */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Line comment: "to-do" (standalone hyphenated)
  {
    code: `// to-do: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Line comment: "TO-DO" (uppercase hyphenated)
  {
    code: `// TO-DO: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Line comment: "to do" (space-separated)
  {
    code: `// to do: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Line comment: "TO DO" (uppercase, space-separated)
  {
    code: `// TO DO: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Block comment: "To-Do"
  {
    code: `/* To-Do: address this */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Block comment: "To Do"
  {
    code: `/* To Do: address this */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // TODO at end of line comment
  {
    code: `// something TODO`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // TODO in parentheses
  {
    code: `// (TODO) handle edge case`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // Multiple TODOs in one block comment
  {
    code: `/* TODO: first thing\n * TODO: second thing */`,
    errors: [{ messageId: 'noTodoComment' }, { messageId: 'noTodoComment' }],
  },
  // TODO in multiline JSDoc
  {
    code: `/**\n * Some description\n * TODO: handle edge case\n */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // "to-do" standalone at end of comment
  {
    code: `// this is a to-do`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // "to do" at beginning of comment
  {
    code: `// to do later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  // TODO followed by colon (common pattern)
  {
    code: `// TODO: implement error handling`,
    errors: [{ messageId: 'noTodoComment' }],
  },
]

ruleTester.run('no-todo-comments', rule, {
  valid: validCases,
  invalid: invalidCases,
})
