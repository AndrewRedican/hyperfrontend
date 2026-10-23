import { testRule } from '../../testing/rule-tester'
import rule from './jsx-no-target-blank'

/** The message reported. */
const MESSAGE =
  'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations'

// why: the workspace runs the rule with its default options; the cases with options are left out.
testRule(rule, {
  valid: [
    { name: '#1 <a href="foobar"></a>', path: '/root/react.tsx', text: '<a href="foobar"></a>' },
    {
      name: '#12 <a href={`foobar`} target={`_blank`} rel={`noopener noreferr…',
      path: '/root/react.tsx',
      text: '<a href={`foobar`} target={`_blank`} rel={`noopener noreferrer`}></a>',
    },
    {
      name: '#14 <a target="_blank" {...spreadProps} rel="noopener noreferrer…',
      path: '/root/react.tsx',
      text: '<a target="_blank" {...spreadProps} rel="noopener noreferrer"></a>',
    },
    { name: '#20 <p target="_blank"></p>', path: '/root/react.tsx', text: '<p target="_blank"></p>' },
    {
      name: '#32 <a target={null} href="//example.com"></a>',
      path: '/root/react.tsx',
      text: '<a target={null} href="//example.com"></a>',
    },
    {
      name: '#58 <a href={href} target={isExternal ? "_blank" : undefined} re…',
      path: '/root/react.tsx',
      text: '<a href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined} />',
    },
    {
      name: '#66 <a target="_blank" href="https://example.com" rel={`noreferr…',
      path: '/root/react.tsx',
      text: '<a target="_blank" href="https://example.com" rel={`noreferrer ${extra}`}></a>',
    },
  ],
  invalid: [
    {
      name: '#72 <a target="_blank" rel="" href="https://example.com/2"></a>',
      path: '/root/react.tsx',
      text: '<a target="_blank" rel="" href="https://example.com/2"></a>',
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 56,
        },
      ],
      output: '<a target="_blank" rel="noreferrer" href="https://example.com/2"></a>',
    },
    {
      name: '#73 <a target="_blank" rel={0} href="https://example.com/3"></a>',
      path: '/root/react.tsx',
      text: '<a target="_blank" rel={0} href="https://example.com/3"></a>',
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 57,
        },
      ],
      output: '<a target="_blank" rel="noreferrer" href="https://example.com/3"></a>',
    },
    {
      name: '#81 <a target="_blank" href="//example.com/10" rel={true}></a>',
      path: '/root/react.tsx',
      text: '<a target="_blank" href="//example.com/10" rel={true}></a>',
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 55,
        },
      ],
      output: '<a target="_blank" href="//example.com/10" rel="noreferrer"></a>',
    },
    {
      name: '#84 <a target="_blank" href="//example.com/13" rel={getRel()}></…',
      path: '/root/react.tsx',
      text: '<a target="_blank" href="//example.com/13" rel={getRel()}></a>',
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 59,
        },
      ],
      output: null,
    },
    {
      name: '#86 <a target={"_blank"} href={"//example.com/15"} rel={"noopene…',
      path: '/root/react.tsx',
      text: '<a target={"_blank"} href={"//example.com/15"} rel={"noopenernoreferrer"}></a>',
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 75,
        },
      ],
      output: '<a target={"_blank"} href={"//example.com/15"} rel={"noopener noreferrer"}></a>',
    },
    {
      name: '#88 <a target="_blank" href="//example.com/17" rel></a>',
      path: '/root/react.tsx',
      text: '<a target="_blank" href="//example.com/17" rel></a>',
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 48,
        },
      ],
      output: '<a target="_blank" href="//example.com/17" rel="noreferrer"></a>',
    },
    {
      name: '#115 <a href={href} target="_blank" rel={isExternal ? 3 : "noopen…',
      path: '/root/react.tsx',
      text: '<a href={href} target="_blank" rel={isExternal ? 3 : "noopener noreferrer"} />',
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 79,
        },
      ],
      output: null,
    },
    {
      name: '#121 export const Out = () => <a href="https://example.com" targe…',
      path: '/root/out.tsx',
      text: '\n      export const Out = () => <a href="https://example.com" target="_blank">out</a>;\n    ',
      settings: { react: { version: '19.0' } },
      errors: [
        {
          message:
            'Using target="_blank" without rel="noreferrer" (which implies rel="noopener") is a security risk in older browsers: see https://mathiasbynens.github.io/rel-noopener/#recommendations',
          line: 2,
          column: 32,
          endLine: 2,
          endColumn: 78,
        },
      ],
      output: '\n      export const Out = () => <a href="https://example.com" target="_blank" rel="noreferrer">out</a>;\n    ',
    },
  ],
})

testRule(rule, {
  valid: [{ name: 'an element as the target', path: '/root/file.tsx', text: '<a target=<b /> href="//example.com" />' }],
  invalid: [
    {
      name: 'a spread after the target',
      path: '/root/file.tsx',
      text: '<a target="_blank" href="//example.com" {...props} />',
      errors: [{ message: MESSAGE, line: 1, column: 1 }],
    },
    {
      name: 'a spread before the target and no rel',
      path: '/root/file.tsx',
      text: '<a {...props} target="_blank" href="//example.com" />',
      errors: [{ message: MESSAGE, line: 1, column: 1 }],
    },
    {
      name: 'conditions on different names',
      path: '/root/file.tsx',
      text: '<a target={a ? "_blank" : undefined} href="//example.com" rel={b ? "noreferrer" : "other"} />',
      errors: [{ message: MESSAGE, line: 1, column: 1 }],
    },
  ],
})
