import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './prefer-jsdoc-over-trailing-comments'

type TestOptions = readonly []
type MessageIds = 'preferJsDocOverTrailing'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Valid test cases - proper JSDoc usage, no trailing comments, or non-interface contexts
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    code: `interface A {
  /** this is a description */
  someProp: boolean;
}`,
  },
  {
    code: `interface A {
  /** method description */
  someMethod(): void;
}`,
  },
  {
    code: `interface A {
  someProp: boolean;
  someMethod(): void;
}`,
  },
  {
    code: `const x = 1 // this is ok`,
  },
  {
    code: `interface A {
  someProp: boolean; /* block comment */
}`,
  },
  {
    code: `class MyClass {
  myProp: string; // class property comment
}`,
  },
  {
    code: `type MyType = {
  prop: number; // type literal comment
};`,
  },
  {
    code: `const obj = {
  prop: 1, // object literal comment
};`,
  },
]

/**
 * Invalid test cases - trailing comments in interfaces that should be JSDoc
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `interface A {
  someProp: boolean; // this is a description
}`,
    output: `interface A {
  /** this is a description */
  someProp: boolean;
}`,
    errors: [{ messageId: 'preferJsDocOverTrailing' }],
  },
  {
    code: `interface A {
  someMethod(): void; // this is another description
}`,
    output: `interface A {
  /** this is another description */
  someMethod(): void;
}`,
    errors: [{ messageId: 'preferJsDocOverTrailing' }],
  },
  {
    code: `interface A {
  prop1: string; // first property
  prop2: number; // second property
}`,
    output: `interface A {
  /** first property */
  prop1: string;
  /** second property */
  prop2: number;
}`,
    errors: [{ messageId: 'preferJsDocOverTrailing' }, { messageId: 'preferJsDocOverTrailing' }],
  },
  {
    code: `interface A {
  /** existing doc */
  someProp: boolean; // trailing comment
}`,
    errors: [{ messageId: 'preferJsDocOverTrailing' }],
  },
]

ruleTester.run('prefer-jsdoc-over-trailing-comments', rule, {
  valid: validCases,
  invalid: invalidCases,
})
