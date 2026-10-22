import baseConfig from '../../lint.base.config.ts'
import { REACT_RULES } from '../../tools/lint/config/rule-sets.ts'

export default [
  {
    ignores: ['.generated/', '.next/', 'notes/', 'out/', 'node_modules/', 'next-env.d.ts'],
  },
  ...baseConfig,
  {
    // context: the rule governs documentation read at a phone's width. The site's own editorial content is exactly that and keeps the rule; the app's README is an engineering note read on GitHub, where a wide line is a wide line and nothing more.
    files: ['**/*.md'],
    ignores: ['content/**/*.md'],
    rules: {
      'workspace/codeblock-line-width': 'off',
    },
  },
  {
    // Ensure all publishable libraries are documented in content.ts and generate-docs.ts
    files: ['src/lib/content.ts', 'scripts/generate-docs.ts'],
    rules: {
      'workspace/docs-site-libraries': 'error',
    },
  },
  {
    files: ['src/lib/content.ts'],
    rules: {
      'workspace/docs-site-routes': 'error',
      'workspace/docs-site-library-docs': 'error',
      'workspace/docs-site-secondary-entries': 'error',
    },
  },
  {
    // Every app router page must export metadata following the src/lib/metadata.ts conventions
    files: ['src/app/**/page.tsx'],
    rules: {
      'workspace/docs-site-page-metadata': 'error',
    },
  },
  {
    // The landing page inherits the site-default metadata from the root layout by design
    files: ['src/app/page.tsx'],
    rules: {
      'workspace/docs-site-page-metadata': 'off',
    },
  },
  {
    // Allow @hyperfrontend/ imports from npm packages installed in this app's node_modules, and the workspace's
    // package identity data, which the site and the media recorder both read so a package's mark and hue are stated once
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'projects/module-boundaries': [
        'error',
        {
          allow: [
            '^@hyperfrontend/',
            '^.*/assets/brand/[^/]+\\.json$',
            '^.*/lint(\\.base)?\\.config\\.ts$',
            '^(?:\\.\\./)*(?:\\./)?tools/lint/config/[^/]+\\.ts$',
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.tsx', '**/*.jsx'],
    settings: {
      react: {
        version: '19.0',
      },
    },
    rules: {
      ...REACT_RULES,
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-description': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      'jsdoc/check-tag-names': 'off',
      'jsdoc/require-jsdoc': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'workspace/max-file-lines': [
        'error',
        {
          maxLines: 800,
          maxLinesTest: 700,
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      'projects/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/lint.config.ts'],
          ignoredDependencies: [
            // Apps are standalone and install @hyperfrontend packages from npm
            // They should not be subject to monorepo version synchronization rules
            '@hyperfrontend/cryptography',
            '@hyperfrontend/data-utils',
            '@hyperfrontend/function-utils',
            '@hyperfrontend/immutable-api-utils',
            '@hyperfrontend/json-utils',
            '@hyperfrontend/list-utils',
            '@hyperfrontend/logging',
            '@hyperfrontend/network-protocol',
            '@hyperfrontend/nexus',
            '@hyperfrontend/project-scope',
            '@hyperfrontend/random-generator-utils',
            '@hyperfrontend/state-machine',
            '@hyperfrontend/string-utils',
            '@hyperfrontend/time-utils',
            '@hyperfrontend/ui-utils',
            '@hyperfrontend/web-worker',
            // Vendored demo shell tarballs are file: deps outside the Nx project graph,
            // so dependency-checks would auto-remove them; exact names required — list
            // each vendored demo shell here
            '@hyperfrontend/demo-clock-shell',
            '@hyperfrontend/demo-heartbeat-shell',
            '@hyperfrontend/demo-koi-pond-shell',
            // The koi pond's shared model, vendored the same way so the landing page can sketch its fish without a renderer
            '@hyperfrontend/demo-koi-lib',
            // Third-party dependencies used by docs-site
            'mermaid',
            'next',
            'react',
            'react-dom',
            '@tailwindcss/postcss',
            '@tailwindcss/typography',
            '@types/node',
            '@types/react',
            '@types/react-dom',
            // glob is imported only by scripts/, which dependency-checks does not scan
            'glob',
            'tailwindcss',
            'typescript',
          ],
        },
      ],
    },
  },
]
