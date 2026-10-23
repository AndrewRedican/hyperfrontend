import { testRule } from '../../testing/rule-tester'
import rule from './no-fallthrough'

// why: the workspace runs the rule with its default options, and a directive naming the previous tester's prefixed rule id is its own artefact.
testRule(rule, {
  valid: [
    {
      name: '#2 switch(foo) { case 0: a()',
      path: '/root/file.ts',
      text: 'switch(foo) { case 0: a()\n /* falls through */ case 1: b(); }',
    },
    {
      name: '#6 switch(foo) { case 0: { a(); /* falls through */ } case 1: b…',
      path: '/root/file.ts',
      text: 'switch(foo) { case 0: { a(); /* falls through */ } case 1: b(); }',
    },
    {
      name: '#14 function foo() { switch(foo) { case 0: a(); return; case 1: …',
      path: '/root/file.ts',
      text: 'function foo() { switch(foo) { case 0: a(); return; case 1: b(); }; }',
    },
    {
      name: "#15 switch(foo) { case 0: a(); throw 'foo'; case 1: b(); }",
      path: '/root/file.ts',
      text: "switch(foo) { case 0: a(); throw 'foo'; case 1: b(); }",
    },
    {
      name: '#16 while (a) { switch(foo) { case 0: a(); continue; case 1: b()…',
      path: '/root/file.ts',
      text: 'while (a) { switch(foo) { case 0: a(); continue; case 1: b(); } }',
    },
    { name: '#25 switch(foo) { case 0: // comment', path: '/root/file.ts', text: 'switch(foo) { case 0: // comment\n case 1: break; }' },
    {
      name: '#31 function foo() { switch(foo) { case 1: return a; a++; }}',
      path: '/root/file.ts',
      text: 'function foo() { switch(foo) { case 1: return a; a++; }}',
    },
    {
      name: '#34 switch (foo) { case 0: if (a) { break; } else { throw 0; } d…',
      path: '/root/file.ts',
      text: 'switch (foo) { case 0: if (a) { break; } else { throw 0; } default: b(); }',
    },
    {
      name: '#35 switch (foo) { case 0: try { break; } finally {} default: b(…',
      path: '/root/file.ts',
      text: 'switch (foo) { case 0: try { break; } finally {} default: b(); }',
    },
    {
      name: '#36 switch (foo) { case 0: try {} finally { break; } default: b(…',
      path: '/root/file.ts',
      text: 'switch (foo) { case 0: try {} finally { break; } default: b(); }',
    },
    {
      name: '#37 switch (foo) { case 0: try { throw 0; } catch (err) { break;…',
      path: '/root/file.ts',
      text: 'switch (foo) { case 0: try { throw 0; } catch (err) { break; } default: b(); }',
    },
    {
      name: '#38 switch (foo) { case 0: do { throw 0; } while(a); default: b(…',
      path: '/root/file.ts',
      text: 'switch (foo) { case 0: do { throw 0; } while(a); default: b(); }',
    },
    {
      name: '#60 a function expression inside the case keeps the case reachability of its own',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: run(() => { return }); break; case 2: b() }',
    },
  ],
  invalid: [
    {
      name: '#73 switch(foo) { case 0: while (a) { break; } default: b() }',
      path: '/root/file.ts',
      text: 'switch(foo) { case 0: while (a) { break; } default: b() }',
      errors: [{ message: "Expected a 'break' statement before 'default'.", line: 1, column: 44, endLine: 1, endColumn: 56 }],
    },
    {
      name: '#75 switch(foo) { case 0:',
      path: '/root/file.ts',
      text: 'switch(foo) { case 0:\n\n default: b() }',
      errors: [{ message: "Expected a 'break' statement before 'default'.", line: 3, column: 2, endLine: 3, endColumn: 14 }],
    },
    {
      name: '#100 a directive comment is not a fallthrough comment',
      path: '/root/file.ts',
      text: 'switch (a) {\n  case 1:\n    b()\n    /* exported falls through */\n  case 2:\n    c()\n}',
      errors: [{ message: "Expected a 'break' statement before 'case'.", line: 5, column: 3, endLine: 6, endColumn: 8 }],
    },
    {
      name: '#102 a switch nested in a case reports its own fallthrough and the outer one',
      path: '/root/file.ts',
      text: 'switch (a) { case 1: switch (b) { case 2: x()\n case 3: y() }\n case 4: z() }',
      errors: [
        { message: "Expected a 'break' statement before 'case'.", line: 2, column: 2, endLine: 2, endColumn: 13 },
        { message: "Expected a 'break' statement before 'case'.", line: 3, column: 2, endLine: 3, endColumn: 13 },
      ],
    },
    {
      name: '#104 a conditional return leaves a reachable path',
      path: '/root/file.ts',
      text: 'function f() { switch (a) { case 1: if (b) { return } case 2: c() } }',
      errors: [{ message: "Expected a 'break' statement before 'case'.", line: 1, column: 55, endLine: 1, endColumn: 66 }],
    },
  ],
})
