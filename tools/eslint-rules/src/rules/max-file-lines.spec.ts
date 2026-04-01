import { createTypeScriptRuleTester } from '../testing'
import rule, { RULE_NAME } from './max-file-lines'

const ruleTester = createTypeScriptRuleTester()

/**
 * Helper to generate code with a specific number of lines and functions.
 *
 * @param lines - Number of lines to generate.
 * @param functionCount - Number of functions to include.
 * @returns Generated code string.
 */
function generateCode(lines: number, functionCount: number): string {
  const functions: string[] = []
  for (let i = 0; i < functionCount; i++) {
    functions.push(`function fn${i}() { return ${i}; }`)
  }

  const functionsCode = functions.join('\n')
  const currentLines = functionsCode.split('\n').length
  const paddingNeeded = lines - currentLines

  if (paddingNeeded <= 0) {
    return functionsCode
  }

  const padding = Array(paddingNeeded).fill('// padding line').join('\n')
  return `${functionsCode}\n${padding}`
}

/**
 * Helper to generate code with arrow functions.
 *
 * @param lines - Number of lines to generate.
 * @param functionCount - Number of arrow functions to include.
 * @returns Generated code string.
 */
function generateArrowFunctionCode(lines: number, functionCount: number): string {
  const functions: string[] = []
  for (let i = 0; i < functionCount; i++) {
    functions.push(`const fn${i} = () => ${i};`)
  }

  const functionsCode = functions.join('\n')
  const currentLines = functionsCode.split('\n').length
  const paddingNeeded = lines - currentLines

  if (paddingNeeded <= 0) {
    return functionsCode
  }

  const padding = Array(paddingNeeded).fill('// padding line').join('\n')
  return `${functionsCode}\n${padding}`
}

/**
 * Helper to generate class code with methods.
 *
 * @param lines - Number of lines to generate.
 * @param methodCount - Number of methods to include.
 * @returns Generated code string.
 */
function generateClassCode(lines: number, methodCount: number): string {
  const methods: string[] = []
  for (let i = 0; i < methodCount; i++) {
    methods.push(`  method${i}() { return ${i}; }`)
  }

  const classCode = `class MyClass {\n${methods.join('\n')}\n}`
  const currentLines = classCode.split('\n').length
  const paddingNeeded = lines - currentLines

  if (paddingNeeded <= 0) {
    return classCode
  }

  const padding = Array(paddingNeeded).fill('// padding line').join('\n')
  return `${classCode}\n${padding}`
}

ruleTester.run(RULE_NAME, rule, {
  valid: [
    {
      name: 'allows file with single function regardless of line count',
      code: generateCode(500, 1),
    },
    {
      name: 'allows file with no functions regardless of line count',
      code: Array(400).fill('const x = 1;').join('\n'),
    },
    {
      name: 'allows file with multiple functions under default limit',
      code: generateCode(200, 3),
    },
    {
      name: 'allows file at exactly the default limit',
      code: generateCode(300, 2),
    },
    {
      name: 'allows file with custom maxLines limit',
      code: generateCode(150, 2),
      options: [{ maxLines: 200 }],
    },
    {
      name: 'allows test file under default test limit',
      code: generateCode(400, 3),
      filename: 'my-file.spec.ts',
    },
    {
      name: 'allows test file at exactly the test limit',
      code: generateCode(500, 2),
      filename: 'my-file.spec.ts',
    },
    {
      name: 'allows test file with custom maxLinesTest',
      code: generateCode(300, 2),
      filename: 'my-file.test.ts',
      options: [{ maxLinesTest: 400 }],
    },
    {
      name: 'allows file with single arrow function',
      code: generateArrowFunctionCode(500, 1),
    },
    {
      name: 'allows file with multiple arrow functions under limit',
      code: generateArrowFunctionCode(200, 3),
    },
    {
      name: 'allows class with single method regardless of lines',
      code: generateClassCode(500, 1),
    },
    {
      name: 'allows class with multiple methods under limit',
      code: generateClassCode(200, 5),
    },
    {
      name: 'recognizes .test.ts as test file',
      code: generateCode(400, 2),
      filename: 'example.test.ts',
    },
    {
      name: 'recognizes .spec.js as test file',
      code: generateCode(400, 2),
      filename: 'example.spec.js',
    },
    {
      name: 'recognizes .test.js as test file',
      code: generateCode(400, 2),
      filename: 'example.test.js',
    },
    {
      name: 'recognizes .spec.tsx as test file',
      code: generateCode(400, 2),
      filename: 'example.spec.tsx',
    },
    {
      name: 'recognizes .test.tsx as test file',
      code: generateCode(400, 2),
      filename: 'example.test.tsx',
    },
    {
      name: 'allows function expression under limit',
      code: `const fn1 = function() { return 1; };\nconst fn2 = function() { return 2; };\n${Array(200).fill('// padding').join('\n')}`,
    },
    {
      name: 'handles mixed function types under limit',
      code: `function regular() {}\nconst arrow = () => {};\nconst expr = function() {};\n${Array(200).fill('// padding').join('\n')}`,
    },
  ],

  invalid: [
    {
      name: 'flags file with multiple functions exceeding default limit',
      code: generateCode(350, 2),
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '350', maxLines: '300' },
        },
      ],
    },
    {
      name: 'flags file exceeding custom maxLines',
      code: generateCode(250, 2),
      options: [{ maxLines: 200 }],
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '250', maxLines: '200' },
        },
      ],
    },
    {
      name: 'flags test file exceeding default test limit',
      code: generateCode(550, 2),
      filename: 'example.spec.ts',
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '550', maxLines: '500' },
        },
      ],
    },
    {
      name: 'flags test file exceeding custom maxLinesTest',
      code: generateCode(450, 2),
      filename: 'example.test.ts',
      options: [{ maxLinesTest: 400 }],
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '450', maxLines: '400' },
        },
      ],
    },
    {
      name: 'flags file with arrow functions exceeding limit',
      code: generateArrowFunctionCode(350, 3),
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '350', maxLines: '300' },
        },
      ],
    },
    {
      name: 'flags class with multiple methods exceeding limit',
      code: generateClassCode(350, 5),
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '350', maxLines: '300' },
        },
      ],
    },
    {
      name: 'uses implementation limit for non-test files',
      code: generateCode(350, 2),
      filename: 'my-util.ts',
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '350', maxLines: '300' },
        },
      ],
    },
    {
      name: 'flags file with mixed function types exceeding limit',
      code: `function regular() {}\nconst arrow = () => {};\n${Array(350).fill('// padding').join('\n')}`,
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '352', maxLines: '300' },
        },
      ],
    },
    {
      name: 'applies both maxLines and maxLinesTest when both configured',
      code: generateCode(160, 2),
      options: [{ maxLines: 100, maxLinesTest: 200 }],
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '160', maxLines: '100' },
        },
      ],
    },
    {
      name: 'uses test limit for .spec.jsx files',
      code: generateCode(550, 2),
      filename: 'component.spec.jsx',
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '550', maxLines: '500' },
        },
      ],
    },
    {
      name: 'uses test limit for .test.jsx files',
      code: generateCode(550, 2),
      filename: 'component.test.jsx',
      errors: [
        {
          messageId: 'fileTooLong',
          data: { actualLines: '550', maxLines: '500' },
        },
      ],
    },
  ],
})
