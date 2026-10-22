import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-mixed-type-import.ts'

testRule(rule, {
  valid: [
    {
      name: "#1 import type { User, Config } from './types'",
      path: '/root/file.ts',
      text: "import type { User, Config } from './types'",
    },
    { name: "#5 import express from 'express'", path: '/root/file.ts', text: "import express from 'express'" },
    {
      name: "#7 import React, { useState, useEffect } from 'react'",
      path: '/root/file.ts',
      text: "import React, { useState, useEffect } from 'react'",
    },
    { name: "#8 import * as utils from './utils'", path: '/root/file.ts', text: "import * as utils from './utils'" },
    { name: "#9 import './polyfill'", path: '/root/file.ts', text: "import './polyfill'" },
  ],
  invalid: [
    {
      name: "#13 import { type User, createUser } from './module'",
      path: '/root/file.ts',
      text: "import { type User, createUser } from './module'",
      errors: [
        {
          message:
            "Mixed type and value imports are not allowed. Split into separate statements:\n  import type { TypeA, TypeB } from '...'\n  import { valueA, valueB } from '...'",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 49,
        },
      ],
      output: "import type { User } from './module'\nimport { createUser } from './module'",
    },
    {
      name: "#17 import { type User as U, createUser as create } from './modu…",
      path: '/root/file.ts',
      text: "import { type User as U, createUser as create } from './module'",
      errors: [
        {
          message:
            "Mixed type and value imports are not allowed. Split into separate statements:\n  import type { TypeA, TypeB } from '...'\n  import { valueA, valueB } from '...'",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 64,
        },
      ],
      output: "import type { User as U } from './module'\nimport { createUser as create } from './module'",
    },
  ],
})

const MESSAGE =
  "Mixed type and value imports are not allowed. Split into separate statements:\n  import type { TypeA, TypeB } from '...'\n  import { valueA, valueB } from '...'"

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a default import beside mixed specifiers, kept with the values',
      path: '/w/a.ts',
      text: "import React, { type Props, useState } from 'react'\n",
      errors: [{ message: MESSAGE, line: 1, column: 1, endLine: 1, endColumn: 52 }],
      output: "import type { Props } from 'react'\nimport React, { useState } from 'react'\n",
    },
    {
      name: 'a string-named specifier',
      path: '/w/a.ts',
      text: "import { type 'a-b' as ab, c } from './m'\n",
      errors: [{ message: MESSAGE, line: 1, column: 1, endLine: 1, endColumn: 42 }],
      output: "import type { 'a-b' as ab } from './m'\nimport { c } from './m'\n",
    },
  ],
})
