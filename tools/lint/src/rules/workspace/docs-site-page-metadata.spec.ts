import { testRule } from '../../testing/rule-tester.ts'
import rule from './docs-site-page-metadata.ts'

// why: the recorded file names are absolute, and the rule reads nothing from them but the route.
testRule(rule, {
  valid: [
    {
      name: "#3 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/articles/[slug]/page.tsx',
      text: "import type { Metadata } from 'next'\n\nexport async function generateMetadata(): Promise<Metadata> {\n  return { title: 'Article' }\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#4 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/demos/page.tsx',
      text: "import type { Metadata } from 'next'\n\nexport const generateMetadata = (): Metadata => ({ title: 'Demos' })\n\nexport default function Page() { return null }",
    },
    {
      name: "#5 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/contributing/page.tsx',
      text: "import type { Metadata } from 'next'\n\nconst metadata: Metadata = { title: 'Contributing', description: 'How to contribute.' }\n\nexport { metadata }\n\nexport default function Page() { return null }",
    },
    {
      name: "#6 export { metadata } from './shared-metadata'",
      path: '/root/repo/apps/docs-site/src/app/docs/core-concepts/page.tsx',
      text: "export { metadata } from './shared-metadata'\n\nexport default function Page() { return null }",
    },
    {
      name: '#7 export function Content() { return null }',
      path: '/root/repo/apps/docs-site/src/app/docs/core-concepts/content.tsx',
      text: 'export function Content() { return null }',
    },
    {
      name: "#10 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/utils/string/page.tsx',
      text: "import type { Metadata } from 'next'\nimport { getLibraryMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getLibraryMetadata('string-utils')\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#12 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/versioning/releases/page.tsx',
      text: "import type { Metadata } from 'next'\nimport { getChangelogMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getChangelogMetadata('versioning')\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#16 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/versioning/commits/parse/page.tsx',
      text: "import type { Metadata } from 'next'\nimport { getLibraryMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getLibraryMetadata('whatever')\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#18 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/versioning/commits/parse/page.tsx',
      text: "import type { Metadata } from 'next'\nimport { getSubmoduleMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getSubmoduleMetadata({\n    librarySlug: 'versioning',\n    packageName: '@hyperfrontend/versioning',\n    submodulePath: 'commits/parse',\n    path: 42,\n  })\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#19 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/page.tsx',
      text: "import type { Metadata } from 'next'\n\nexport const metadata: Metadata = { title: 'Docs', description: 'The docs.' }\n\nexport default function Page() {\n  const options = { title: undefined }\n  return options === null ? null : null\n}",
    },
    {
      name: "#21 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/page.tsx',
      text: "import type { Metadata } from 'next'\n\nconst key = 'title'\n\nexport const metadata: Metadata = { [key]: undefined, title: 'Docs', description: 'The docs.' }\n\nexport default function Page() { return null }",
    },
  ],
  invalid: [
    {
      name: "#23 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/utils/string/releases/page.tsx',
      text: "import type { Metadata } from 'next'\nimport { getChangelogMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getChangelogMetadata('string')\n}\n\nexport default function Page() { return null }",
      errors: [
        {
          message: "The slug argument does not match this page route; expected 'string-utils'.",
          line: 5,
          column: 31,
          endLine: 5,
          endColumn: 39,
        },
      ],
      output:
        "import type { Metadata } from 'next'\nimport { getChangelogMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getChangelogMetadata('string-utils')\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#24 import { Breadcrumb } from '@/components/breadcrumb'",
      path: '/root/repo/apps/docs-site/src/app/docs/new-guide/page.tsx',
      text: "import { Breadcrumb } from '@/components/breadcrumb'\nimport Link from 'next/link'\n\nexport default function Page() { return null }",
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\nimport { Breadcrumb } from '@/components/breadcrumb'\nimport Link from 'next/link'\n\nexport const metadata: Metadata = {\n  title: undefined,\n  description: undefined,\n}\n\nexport default function Page() { return null }",
    },
    {
      name: '#26 ',
      path: '/root/repo/apps/docs-site/src/app/docs/empty/page.tsx',
      text: '',
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\n\nexport const metadata: Metadata = {\n  title: undefined,\n  description: undefined,\n}\n",
    },
    {
      name: "#27 import { LibraryDocPage } from '@/components/library-doc-pag…",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/questions/page.tsx',
      text: "import { LibraryDocPage } from '@/components/library-doc-page'\n\nexport default function Page() { return null }",
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\nimport { LibraryDocPage } from '@/components/library-doc-page'\nimport { getLibraryMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getLibraryMetadata('questions')\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#29 import { notFound } from 'next/navigation'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/nexus/architecture/page.tsx',
      text: "import { notFound } from 'next/navigation'\n\nexport default function Page() { return null }",
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\nimport { getArchitectureMetadata } from '@/lib/metadata'\nimport { notFound } from 'next/navigation'\n\nexport function generateMetadata(): Metadata {\n  return getArchitectureMetadata('nexus')\n}\n\nexport default function Page() { return null }",
    },
    {
      name: '#31 export default function Page() { return null }',
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/utils/ui/dom/page.tsx',
      text: 'export default function Page() { return null }',
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\nimport { getSubmoduleMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getSubmoduleMetadata({\n    librarySlug: 'utils/ui',\n    packageName: '@hyperfrontend/ui-utils',\n    submodulePath: 'dom',\n    path: '/docs/libraries/utils/ui/dom/',\n  })\n}\n\nexport default function Page() { return null }",
    },
    {
      name: '#32 export default function Page() { return null }',
      path: '/root/repo/apps/docs-site/src/app/articles/[slug]/page.tsx',
      text: 'export default function Page() { return null }',
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\n\nexport function generateMetadata(): Metadata {\n  return {\n    title: undefined,\n    description: undefined,\n  }\n}\n\nexport default function Page() { return null }",
    },
    {
      name: '#34 export default function Page() { return null }',
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/utils/page.tsx',
      text: 'export default function Page() { return null }',
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\n\nexport const metadata: Metadata = {\n  title: undefined,\n  description: undefined,\n}\n\nexport default function Page() { return null }",
    },
    {
      name: '#35 export default function Page() { return null }',
      path: '/root/repo/apps/docs-site/src/app/page.tsx',
      text: 'export default function Page() { return null }',
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\n\nexport const metadata: Metadata = {\n  title: undefined,\n  description: undefined,\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#36 'use client'",
      path: '/root/repo/apps/docs-site/src/app/docs/interactive/page.tsx',
      text: "'use client'\n\nexport default function Page() { return null }",
      errors: [
        {
          message:
            'Client component pages cannot export metadata. Keep page.tsx a server component and move the client logic into a child component.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 13,
        },
      ],
      output: null,
    },
    {
      name: "#39 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/articles/[slug]/page.tsx',
      text: "import type { Metadata } from 'next'\n\nexport function generateMetadata(): Metadata {\n  return {\n    title: undefined,\n    description: undefined,\n  }\n}\n\nexport default function Page() { return null }",
      errors: [
        {
          message: 'Complete the metadata placeholder: replace undefined with the page title.',
          line: 5,
          column: 12,
          endLine: 5,
          endColumn: 21,
        },
        {
          message: 'Complete the metadata placeholder: replace undefined with the page description.',
          line: 6,
          column: 18,
          endLine: 6,
          endColumn: 27,
        },
      ],
      output: null,
    },
    {
      name: '#40 export const metadata = {',
      path: '/root/repo/apps/docs-site/src/app/docs/new-guide/page.tsx',
      text: "export const metadata = {\n  'title': undefined,\n  description: 'Real description.',\n}\n\nexport default function Page() { return null }",
      errors: [
        {
          message: 'Complete the metadata placeholder: replace undefined with the page title.',
          line: 2,
          column: 12,
          endLine: 2,
          endColumn: 21,
        },
      ],
      output: null,
    },
    {
      name: "#43 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/versioning/commits/format/page.tsx',
      text: "import type { Metadata } from 'next'\nimport { getSubmoduleMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getSubmoduleMetadata({\n    librarySlug: 'versioning',\n    packageName: '@hyperfrontend/versioning',\n    submodulePath: 'commits/parse',\n    path: '/docs/libraries/versioning/commits/parse/',\n  })\n}\n\nexport default function Page() { return null }",
      errors: [
        {
          message: "The submodulePath argument does not match this page route; expected 'commits/format'.",
          line: 8,
          column: 20,
          endLine: 8,
          endColumn: 35,
        },
        {
          message: "The path argument does not match this page route; expected '/docs/libraries/versioning/commits/format/'.",
          line: 9,
          column: 11,
          endLine: 9,
          endColumn: 54,
        },
      ],
      output:
        "import type { Metadata } from 'next'\nimport { getSubmoduleMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getSubmoduleMetadata({\n    librarySlug: 'versioning',\n    packageName: '@hyperfrontend/versioning',\n    submodulePath: 'commits/format',\n    path: '/docs/libraries/versioning/commits/format/',\n  })\n}\n\nexport default function Page() { return null }",
    },
    {
      name: "#44 import type { Metadata } from 'next'",
      path: '/root/repo/apps/docs-site/src/app/docs/libraries/logging/page.tsx',
      text: "import type { Metadata } from 'next'\nimport { DEFAULT_OG_IMAGE } from '@/lib/metadata'\n\nexport default function Page() { return null }",
      errors: [
        {
          message:
            'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      output:
        "import type { Metadata } from 'next'\nimport { DEFAULT_OG_IMAGE, getLibraryMetadata } from '@/lib/metadata'\n\nexport function generateMetadata(): Metadata {\n  return getLibraryMetadata('logging')\n}\n\nexport default function Page() { return null }",
    },
  ],
})

// why: the cases recorded from the previous linter leave member callees and spread arguments unexercised.
testRule(rule, {
  valid: [
    {
      name: 'a member callee and a spread argument',
      path: '/repo/apps/docs-site/src/app/docs/libraries/versioning/commits/parse/page.tsx',
      text: "export const metadata = {}\nlib.getSubmoduleMetadata({})\ngetSubmoduleMetadata({ ...base, [key]: 'x' })",
    },
  ],
  invalid: [],
})
