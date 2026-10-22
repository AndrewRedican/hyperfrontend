import { testRule } from '../../testing/rule-tester.ts'
import rule from './use-isnan.ts'

// why: the workspace checks switch statements and leaves indexOf calls alone, as upstream does by default; the cases recorded with enforceForIndexOf on or enforceForSwitchCase off are left out.
testRule(rule, {
  valid: [
    { name: '#98 var x = NaN;', path: '/root/file.ts', text: 'var x = NaN;' },
    { name: '#99 isNaN(NaN) === true;', path: '/root/file.ts', text: 'isNaN(NaN) === true;' },
    { name: '#109 foo(NaN / 2)', path: '/root/file.ts', text: 'foo(NaN / 2)' },
    { name: '#111 var x; if (x = NaN) { }', path: '/root/file.ts', text: 'var x; if (x = NaN) { }' },
    { name: '#124 x === Number[NaN];', path: '/root/file.ts', text: 'x === Number[NaN];' },
    { name: '#128 an operator outside the comparison set is not a comparison', path: '/root/file.ts', text: 'x ** NaN' },
    { name: '#129 the in operator is not a comparison', path: '/root/file.ts', text: 'x in NaN' },
    { name: '#132 a member named NaN on another object is not NaN', path: '/root/file.ts', text: 'x === foo.NaN' },
    { name: '#134 a type-asserted NaN is a different node', path: '/root/file.ts', text: 'x === (NaN as number)' },
    { name: '#135 a non-null-asserted NaN is a different node', path: '/root/file.ts', text: 'x === NaN!' },
  ],
  invalid: [
    {
      name: '#147 NaN < "abc";',
      path: '/root/file.ts',
      text: 'NaN < "abc";',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 1, column: 1, endLine: 1, endColumn: 12 }],
    },
    {
      name: '#149 NaN > "abc";',
      path: '/root/file.ts',
      text: 'NaN > "abc";',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 1, column: 1, endLine: 1, endColumn: 12 }],
    },
    {
      name: '#153 NaN >= "abc";',
      path: '/root/file.ts',
      text: 'NaN >= "abc";',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 1, column: 1, endLine: 1, endColumn: 13 }],
    },
    {
      name: '#164 "abc" < Number.NaN;',
      path: '/root/file.ts',
      text: '"abc" < Number.NaN;',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 1, column: 1, endLine: 1, endColumn: 19 }],
    },
    {
      name: '#171 x === Number?.NaN;',
      path: '/root/file.ts',
      text: 'x === Number?.NaN;',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 1, column: 1, endLine: 1, endColumn: 18 }],
    },
    {
      name: '#174 /* just',
      path: '/root/file.ts',
      text: '/* just\n                adding */ x /* some */ === /* comments */ NaN; // here',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 2, column: 27, endLine: 2, endColumn: 62 }],
    },
    {
      name: '#185 a loose comparison with a sequence wraps it in both suggestions',
      path: '/root/file.ts',
      text: '(a, b) != NaN',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 1, column: 1, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#188 a comparison nested in a larger expression keeps its surroundings',
      path: '/root/file.ts',
      text: 'foo(a === NaN && b)',
      errors: [{ message: 'Use the isNaN function to compare with NaN.', line: 1, column: 5, endLine: 1, endColumn: 14 }],
    },
    {
      name: '#240 switch(foo) { case (NaN): break; }',
      path: '/root/file.ts',
      text: 'switch(foo) { case (NaN): break; }',
      options: { enforceForSwitchCase: true },
      errors: [
        { message: "'case NaN' can never match. Use Number.isNaN before the switch.", line: 1, column: 15, endLine: 1, endColumn: 33 },
      ],
    },
    {
      name: '#263 the reported range of a case covers the clause and its body',
      path: '/root/file.ts',
      text: 'switch (foo) {\n  case NaN:\n    break\n  default:\n}',
      errors: [
        { message: "'case NaN' can never match. Use Number.isNaN before the switch.", line: 2, column: 3, endLine: 3, endColumn: 10 },
      ],
    },
    {
      name: '#265 a bracket access of Number.NaN is NaN',
      path: '/root/file.ts',
      text: "switch (Number['NaN']) { case Number[`NaN`]: break }",
      errors: [
        {
          message: "'switch(NaN)' can never match a case clause. Use Number.isNaN instead of the switch.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 53,
        },
        { message: "'case NaN' can never match. Use Number.isNaN before the switch.", line: 1, column: 26, endLine: 1, endColumn: 51 },
      ],
    },
    {
      name: '#267 a sequence case ending in NaN is reported',
      path: '/root/file.ts',
      text: 'switch (foo) { case (doStuff(), NaN): break }',
      errors: [
        { message: "'case NaN' can never match. Use Number.isNaN before the switch.", line: 1, column: 16, endLine: 1, endColumn: 44 },
      ],
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'a switch on NaN when switch statements are not checked',
      path: '/w/a.ts',
      text: 'switch (NaN) { case NaN: break }',
      options: { enforceForSwitchCase: false },
    },
  ],
  invalid: [],
})
