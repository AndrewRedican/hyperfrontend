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
  {
    code: `// This is a regular comment`,
  },
  {
    code: `/* Block comment without markers */`,
  },
  {
    code: `/** JSDoc comment without markers */`,
  },
  {
    code: `// See path-to-document for details`,
  },
  {
    code: `/* Check path-to-document */`,
  },
  {
    code: `/** @see path-to-document */`,
  },
  {
    code: `// Prevent auto download of files`,
  },
  {
    code: `/* auto download security risk */`,
  },
  {
    code: `// See auto-download feature`,
  },
  {
    code: `// Use the how-to-do-it guide`,
  },
  {
    code: `// The todoItem variable`,
  },
  {
    code: `// See factoid for more`,
  },
  {
    code: `// The todo-app package`,
  },
  {
    code: `// See react-todo-list`,
  },
  {
    code: `const x = 1`,
  },
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
  {
    code: `// todo fix this`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// TODO fix this`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// Todo: fix this later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// ToDo: refactor`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `/* TODO: implement this */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `/** TODO: add return type */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `/** @todo fix the implementation */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// to-do: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// TO-DO: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// to do: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// TO DO: fix later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `/* To-Do: address this */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `/* To Do: address this */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// something TODO`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// (TODO) handle edge case`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `/* TODO: first thing\n * TODO: second thing */`,
    errors: [{ messageId: 'noTodoComment' }, { messageId: 'noTodoComment' }],
  },
  {
    code: `/**\n * Some description\n * TODO: handle edge case\n */`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// this is a to-do`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// to do later`,
    errors: [{ messageId: 'noTodoComment' }],
  },
  {
    code: `// TODO: implement error handling`,
    errors: [{ messageId: 'noTodoComment' }],
  },
]

ruleTester.run('no-todo-comments', rule, {
  valid: validCases,
  invalid: invalidCases,
})
