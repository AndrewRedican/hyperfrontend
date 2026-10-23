import { testRule } from '../../testing/rule-tester'
import rule from './no-namespace-import'

testRule(rule, {
  valid: [
    { name: "#4 import express from 'express'", path: '/root/file.ts', text: "import express from 'express'" },
    {
      name: "#7 import type { Request, Response } from 'express'",
      path: '/root/file.ts',
      text: "import type { Request, Response } from 'express'",
    },
    { name: "#8 import React, { useState } from 'react'", path: '/root/file.ts', text: "import React, { useState } from 'react'" },
    { name: "#11 import './polyfill'", path: '/root/file.ts', text: "import './polyfill'" },
    { name: "#12 import type * as actions from './actions'", path: '/root/file.ts', text: "import type * as actions from './actions'" },
    { name: "#16 import * as v4Schema from './v4.json'", path: '/root/file.ts', text: "import * as v4Schema from './v4.json'" },
  ],
  invalid: [
    {
      name: "#17 import * as utils from './utils'",
      path: '/root/file.ts',
      text: "import * as utils from './utils'",
      errors: [
        {
          message:
            "Namespace import 'import * as utils' is not allowed. Use named imports 'import { ... }' to enable tree-shaking and make dependencies explicit.",
          line: 1,
          column: 8,
          endLine: 1,
          endColumn: 18,
        },
      ],
    },
  ],
})
