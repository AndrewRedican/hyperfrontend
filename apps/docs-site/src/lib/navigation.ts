/**
 * Navigation item for the docs site sidebar.
 */
export interface NavItem {
  /** Display title - package slug without `@hyperfrontend/` prefix */
  slug: string
  /** Full package name for reference */
  packageName?: string
  /** Link href */
  href?: string
  /** Nested navigation items */
  children?: NavItem[]
}

/**
 * Core library navigation items.
 * Listed alphabetically for consistency.
 */
const coreLibraries: NavItem[] = [
  {
    slug: 'builder',
    packageName: '@hyperfrontend/builder',
    href: '/docs/libraries/builder',
    children: [
      {
        slug: 'bin',
        href: '/docs/libraries/builder/bin',
        children: [
          {
            slug: 'native',
            href: '/docs/libraries/builder/bin/native',
            children: [{ slug: 'worker', href: '/docs/libraries/builder/bin/native/worker' }],
          },
          { slug: 'script', href: '/docs/libraries/builder/bin/script' },
        ],
      },
      {
        slug: 'bundle',
        href: '/docs/libraries/builder/bundle',
        children: [
          { slug: 'declarations', href: '/docs/libraries/builder/bundle/declarations' },
          { slug: 'dedupe', href: '/docs/libraries/builder/bundle/dedupe' },
          {
            slug: 'dependencies',
            href: '/docs/libraries/builder/bundle/dependencies',
            children: [{ slug: 'worker', href: '/docs/libraries/builder/bundle/dependencies/worker' }],
          },
          { slug: 'entries', href: '/docs/libraries/builder/bundle/entries' },
          { slug: 'externals', href: '/docs/libraries/builder/bundle/externals' },
          {
            slug: 'rollup',
            href: '/docs/libraries/builder/bundle/rollup',
            children: [{ slug: 'worker', href: '/docs/libraries/builder/bundle/rollup/worker' }],
          },
        ],
      },
      { slug: 'memory', href: '/docs/libraries/builder/memory' },
      { slug: 'models', href: '/docs/libraries/builder/models' },
      {
        slug: 'package',
        href: '/docs/libraries/builder/package',
        children: [
          { slug: 'assets', href: '/docs/libraries/builder/package/assets' },
          { slug: 'json', href: '/docs/libraries/builder/package/json' },
          { slug: 'licenses', href: '/docs/libraries/builder/package/licenses' },
        ],
      },
      { slug: 'presets', href: '/docs/libraries/builder/presets' },
    ],
  },
  {
    slug: 'cryptography',
    packageName: '@hyperfrontend/cryptography',
    href: '/docs/libraries/cryptography',
    children: [
      { slug: 'browser', href: '/docs/libraries/cryptography/browser' },
      { slug: 'common', href: '/docs/libraries/cryptography/common' },
      { slug: 'node', href: '/docs/libraries/cryptography/node' },
    ],
  },
  {
    slug: 'features',
    packageName: '@hyperfrontend/features',
    href: '/docs/libraries/features',
    children: [
      { slug: 'host', href: '/docs/libraries/features/host' },
      { slug: 'hostee', href: '/docs/libraries/features/hostee' },
      { slug: 'cli', href: '/docs/libraries/features/cli' },
      { slug: 'server', href: '/docs/libraries/features/server' },
      { slug: 'generators', href: '/docs/libraries/features/generators' },
      { slug: 'nx/generators/feature', href: '/docs/libraries/features/nx/generators/feature' },
      { slug: 'nx/executors/build', href: '/docs/libraries/features/nx/executors/build' },
      { slug: 'nx/executors/serve', href: '/docs/libraries/features/nx/executors/serve' },
    ],
  },
  {
    slug: 'network-protocol',
    packageName: '@hyperfrontend/network-protocol',
    href: '/docs/libraries/network-protocol',
    children: [
      {
        slug: 'browser',
        href: '/docs/libraries/network-protocol/browser',
        children: [
          { slug: 'channel', href: '/docs/libraries/network-protocol/browser/channel' },
          { slug: 'data', href: '/docs/libraries/network-protocol/browser/data' },
          { slug: 'packet', href: '/docs/libraries/network-protocol/browser/packet' },
          { slug: 'receiver', href: '/docs/libraries/network-protocol/browser/receiver' },
          { slug: 'sender', href: '/docs/libraries/network-protocol/browser/sender' },
          { slug: 'v1', href: '/docs/libraries/network-protocol/browser/v1' },
          { slug: 'v2', href: '/docs/libraries/network-protocol/browser/v2' },
        ],
      },
      {
        slug: 'node',
        href: '/docs/libraries/network-protocol/node',
        children: [
          { slug: 'channel', href: '/docs/libraries/network-protocol/node/channel' },
          { slug: 'data', href: '/docs/libraries/network-protocol/node/data' },
          { slug: 'packet', href: '/docs/libraries/network-protocol/node/packet' },
          { slug: 'receiver', href: '/docs/libraries/network-protocol/node/receiver' },
          { slug: 'sender', href: '/docs/libraries/network-protocol/node/sender' },
          { slug: 'v1', href: '/docs/libraries/network-protocol/node/v1' },
          { slug: 'v2', href: '/docs/libraries/network-protocol/node/v2' },
        ],
      },
      { slug: 'queue', href: '/docs/libraries/network-protocol/queue' },
      { slug: 'routing', href: '/docs/libraries/network-protocol/routing' },
      { slug: 'security', href: '/docs/libraries/network-protocol/security' },
      { slug: 'topic', href: '/docs/libraries/network-protocol/topic' },
    ],
  },
  { slug: 'nexus', packageName: '@hyperfrontend/nexus', href: '/docs/libraries/nexus' },
]

/**
 * Supporting library navigation items.
 * Listed alphabetically for consistency.
 */
const supportingLibraries: NavItem[] = [
  { slug: 'logging', packageName: '@hyperfrontend/logging', href: '/docs/libraries/logging' },
  {
    slug: 'project-scope',
    packageName: '@hyperfrontend/project-scope',
    href: '/docs/libraries/project-scope',
    children: [
      { slug: 'cli', href: '/docs/libraries/project-scope/cli' },
      {
        slug: 'core',
        href: '/docs/libraries/project-scope/core',
        children: [
          { slug: 'encoding', href: '/docs/libraries/project-scope/core/encoding' },
          { slug: 'fs', href: '/docs/libraries/project-scope/core/fs' },
          { slug: 'logger', href: '/docs/libraries/project-scope/core/logger' },
          { slug: 'path', href: '/docs/libraries/project-scope/core/path' },
          { slug: 'platform', href: '/docs/libraries/project-scope/core/platform' },
        ],
      },
      {
        slug: 'heuristics',
        href: '/docs/libraries/project-scope/heuristics',
        children: [
          { slug: 'dependencies', href: '/docs/libraries/project-scope/heuristics/dependencies' },
          { slug: 'entry-points', href: '/docs/libraries/project-scope/heuristics/entry-points' },
          { slug: 'framework', href: '/docs/libraries/project-scope/heuristics/framework' },
          { slug: 'project-type', href: '/docs/libraries/project-scope/heuristics/project-type' },
        ],
      },
      { slug: 'models', href: '/docs/libraries/project-scope/models' },
      { slug: 'nx', href: '/docs/libraries/project-scope/nx' },
      {
        slug: 'project',
        href: '/docs/libraries/project-scope/project',
        children: [
          { slug: 'config', href: '/docs/libraries/project-scope/project/config' },
          { slug: 'package', href: '/docs/libraries/project-scope/project/package' },
          { slug: 'root', href: '/docs/libraries/project-scope/project/root' },
          { slug: 'traversal', href: '/docs/libraries/project-scope/project/traversal' },
        ],
      },
      {
        slug: 'tech',
        href: '/docs/libraries/project-scope/tech',
        children: [
          { slug: 'backend', href: '/docs/libraries/project-scope/tech/backend' },
          { slug: 'build', href: '/docs/libraries/project-scope/tech/build' },
          { slug: 'frontend', href: '/docs/libraries/project-scope/tech/frontend' },
          { slug: 'legacy', href: '/docs/libraries/project-scope/tech/legacy' },
          { slug: 'linting', href: '/docs/libraries/project-scope/tech/linting' },
          { slug: 'monorepo', href: '/docs/libraries/project-scope/tech/monorepo' },
          { slug: 'testing', href: '/docs/libraries/project-scope/tech/testing' },
          { slug: 'types', href: '/docs/libraries/project-scope/tech/types' },
        ],
      },
      { slug: 'vfs', href: '/docs/libraries/project-scope/vfs' },
    ],
  },
  { slug: 'questions', packageName: '@hyperfrontend/questions', href: '/docs/libraries/questions' },
  {
    slug: 'state-machine',
    packageName: '@hyperfrontend/state-machine',
    href: '/docs/libraries/state-machine',
    children: [
      { slug: 'actions', href: '/docs/libraries/state-machine/actions' },
      { slug: 'async-operation', href: '/docs/libraries/state-machine/async-operation' },
      { slug: 'coordinated-async-operation', href: '/docs/libraries/state-machine/coordinated-async-operation' },
      { slug: 'events', href: '/docs/libraries/state-machine/events' },
      { slug: 'lifecycle-aware-component', href: '/docs/libraries/state-machine/lifecycle-aware-component' },
      { slug: 'models', href: '/docs/libraries/state-machine/models' },
      { slug: 'reducer', href: '/docs/libraries/state-machine/reducer' },
      { slug: 'selectors', href: '/docs/libraries/state-machine/selectors' },
      { slug: 'state', href: '/docs/libraries/state-machine/state' },
      { slug: 'state-change', href: '/docs/libraries/state-machine/state-change' },
      { slug: 'store', href: '/docs/libraries/state-machine/store' },
    ],
  },
  {
    slug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    href: '/docs/libraries/versioning',
    children: [
      {
        slug: 'changelog',
        href: '/docs/libraries/versioning/changelog',
        children: [
          { slug: 'compare', href: '/docs/libraries/versioning/changelog/compare' },
          { slug: 'models', href: '/docs/libraries/versioning/changelog/models' },
          { slug: 'operations', href: '/docs/libraries/versioning/changelog/operations' },
          { slug: 'parse', href: '/docs/libraries/versioning/changelog/parse' },
          { slug: 'serialize', href: '/docs/libraries/versioning/changelog/serialize' },
        ],
      },
      {
        slug: 'commits',
        href: '/docs/libraries/versioning/commits',
        children: [
          { slug: 'author', href: '/docs/libraries/versioning/commits/author' },
          { slug: 'classify', href: '/docs/libraries/versioning/commits/classify' },
          { slug: 'format', href: '/docs/libraries/versioning/commits/format' },
          { slug: 'models', href: '/docs/libraries/versioning/commits/models' },
          { slug: 'parse', href: '/docs/libraries/versioning/commits/parse' },
          { slug: 'validate', href: '/docs/libraries/versioning/commits/validate' },
        ],
      },
      {
        slug: 'flow',
        href: '/docs/libraries/versioning/flow',
        children: [
          { slug: 'executor', href: '/docs/libraries/versioning/flow/executor' },
          { slug: 'models', href: '/docs/libraries/versioning/flow/models' },
          { slug: 'presets', href: '/docs/libraries/versioning/flow/presets' },
          { slug: 'steps', href: '/docs/libraries/versioning/flow/steps' },
        ],
      },
      {
        slug: 'git',
        href: '/docs/libraries/versioning/git',
        children: [
          { slug: 'models', href: '/docs/libraries/versioning/git/models' },
          { slug: 'operations', href: '/docs/libraries/versioning/git/operations' },
        ],
      },
      {
        slug: 'registry',
        href: '/docs/libraries/versioning/registry',
        children: [
          { slug: 'models', href: '/docs/libraries/versioning/registry/models' },
          { slug: 'npm', href: '/docs/libraries/versioning/registry/npm' },
        ],
      },
      {
        slug: 'repository',
        href: '/docs/libraries/versioning/repository',
        children: [
          { slug: 'models', href: '/docs/libraries/versioning/repository/models' },
          { slug: 'parse', href: '/docs/libraries/versioning/repository/parse' },
          { slug: 'url', href: '/docs/libraries/versioning/repository/url' },
        ],
      },
      {
        slug: 'semver',
        href: '/docs/libraries/versioning/semver',
        children: [
          { slug: 'compare', href: '/docs/libraries/versioning/semver/compare' },
          { slug: 'format', href: '/docs/libraries/versioning/semver/format' },
          { slug: 'increment', href: '/docs/libraries/versioning/semver/increment' },
          { slug: 'models', href: '/docs/libraries/versioning/semver/models' },
          { slug: 'parse', href: '/docs/libraries/versioning/semver/parse' },
        ],
      },
      {
        slug: 'workspace',
        href: '/docs/libraries/versioning/workspace',
        children: [
          { slug: 'discovery', href: '/docs/libraries/versioning/workspace/discovery' },
          { slug: 'models', href: '/docs/libraries/versioning/workspace/models' },
          { slug: 'operations', href: '/docs/libraries/versioning/workspace/operations' },
        ],
      },
    ],
  },
  { slug: 'web-worker', packageName: '@hyperfrontend/web-worker', href: '/docs/libraries/web-worker' },
]

/**
 * Utility library navigation items.
 * Listed alphabetically for consistency.
 */
const utilsLibraries: NavItem[] = [
  { slug: 'data-utils', packageName: '@hyperfrontend/data-utils', href: '/docs/libraries/utils/data' },
  { slug: 'function-utils', packageName: '@hyperfrontend/function-utils', href: '/docs/libraries/utils/function' },
  {
    slug: 'immutable-api-utils',
    packageName: '@hyperfrontend/immutable-api-utils',
    href: '/docs/libraries/utils/immutable-api',
    children: [
      {
        slug: 'built-in-copy',
        href: '/docs/libraries/utils/immutable-api/built-in-copy',
        children: [
          { slug: 'array', href: '/docs/libraries/utils/immutable-api/built-in-copy/array' },
          { slug: 'console', href: '/docs/libraries/utils/immutable-api/built-in-copy/console' },
          { slug: 'date', href: '/docs/libraries/utils/immutable-api/built-in-copy/date' },
          { slug: 'encoding', href: '/docs/libraries/utils/immutable-api/built-in-copy/encoding' },
          { slug: 'error', href: '/docs/libraries/utils/immutable-api/built-in-copy/error' },
          { slug: 'function', href: '/docs/libraries/utils/immutable-api/built-in-copy/function' },
          { slug: 'json', href: '/docs/libraries/utils/immutable-api/built-in-copy/json' },
          { slug: 'map', href: '/docs/libraries/utils/immutable-api/built-in-copy/map' },
          { slug: 'math', href: '/docs/libraries/utils/immutable-api/built-in-copy/math' },
          { slug: 'messaging', href: '/docs/libraries/utils/immutable-api/built-in-copy/messaging' },
          { slug: 'number', href: '/docs/libraries/utils/immutable-api/built-in-copy/number' },
          { slug: 'object', href: '/docs/libraries/utils/immutable-api/built-in-copy/object' },
          { slug: 'promise', href: '/docs/libraries/utils/immutable-api/built-in-copy/promise' },
          { slug: 'reflect', href: '/docs/libraries/utils/immutable-api/built-in-copy/reflect' },
          { slug: 'regexp', href: '/docs/libraries/utils/immutable-api/built-in-copy/regexp' },
          { slug: 'set', href: '/docs/libraries/utils/immutable-api/built-in-copy/set' },
          { slug: 'string', href: '/docs/libraries/utils/immutable-api/built-in-copy/string' },
          { slug: 'symbol', href: '/docs/libraries/utils/immutable-api/built-in-copy/symbol' },
          { slug: 'timers', href: '/docs/libraries/utils/immutable-api/built-in-copy/timers' },
          { slug: 'typed-arrays', href: '/docs/libraries/utils/immutable-api/built-in-copy/typed-arrays' },
          { slug: 'url', href: '/docs/libraries/utils/immutable-api/built-in-copy/url' },
          { slug: 'weak-map', href: '/docs/libraries/utils/immutable-api/built-in-copy/weak-map' },
          { slug: 'weak-set', href: '/docs/libraries/utils/immutable-api/built-in-copy/weak-set' },
          { slug: 'websocket', href: '/docs/libraries/utils/immutable-api/built-in-copy/websocket' },
        ],
      },
      { slug: 'locked', href: '/docs/libraries/utils/immutable-api/locked' },
      { slug: 'locked-prop-descriptors', href: '/docs/libraries/utils/immutable-api/locked-prop-descriptors' },
      { slug: 'locked-props', href: '/docs/libraries/utils/immutable-api/locked-props' },
    ],
  },
  { slug: 'json-utils', packageName: '@hyperfrontend/json-utils', href: '/docs/libraries/utils/json' },
  { slug: 'list-utils', packageName: '@hyperfrontend/list-utils', href: '/docs/libraries/utils/list' },
  { slug: 'random-generator-utils', packageName: '@hyperfrontend/random-generator-utils', href: '/docs/libraries/utils/random-generator' },
  {
    slug: 'string-utils',
    packageName: '@hyperfrontend/string-utils',
    href: '/docs/libraries/utils/string',
    children: [
      { slug: 'browser', href: '/docs/libraries/utils/string/browser' },
      { slug: 'node', href: '/docs/libraries/utils/string/node' },
    ],
  },
  { slug: 'time-utils', packageName: '@hyperfrontend/time-utils', href: '/docs/libraries/utils/time' },
  {
    slug: 'ui-utils',
    packageName: '@hyperfrontend/ui-utils',
    href: '/docs/libraries/utils/ui',
    children: [
      { slug: 'audio', href: '/docs/libraries/utils/ui/audio' },
      { slug: 'color', href: '/docs/libraries/utils/ui/color' },
      { slug: 'component', href: '/docs/libraries/utils/ui/component' },
      { slug: 'element', href: '/docs/libraries/utils/ui/element' },
      { slug: 'event', href: '/docs/libraries/utils/ui/event' },
      { slug: 'misc', href: '/docs/libraries/utils/ui/misc' },
      { slug: 'mobile', href: '/docs/libraries/utils/ui/mobile' },
      { slug: 'selector', href: '/docs/libraries/utils/ui/selector' },
      { slug: 'style', href: '/docs/libraries/utils/ui/style' },
      { slug: 'time', href: '/docs/libraries/utils/ui/time' },
    ],
  },
]

/**
 * Getting started section navigation.
 */
const gettingStarted: NavItem[] = [
  { slug: 'Installation', href: '/docs' },
  { slug: 'Quick Start', href: '/docs/quick-start' },
  { slug: 'Core Concepts', href: '/docs/core-concepts' },
]

/**
 * Main navigation link items for header/mobile main nav.
 */
export const mainNavLinks = [
  { slug: 'Docs', href: '/docs' },
  { slug: 'Demos', href: '/demos' },
  { slug: 'Architecture', href: '/architecture' },
]

/**
 * Complete documentation navigation structure.
 *
 * This is the canonical navigation data used by both
 * the desktop sidebar and mobile menu components.
 */
export const docsNavigation: NavItem[] = [
  {
    slug: 'Getting Started',
    children: gettingStarted,
  },
  {
    slug: 'Libraries',
    children: [...coreLibraries, ...supportingLibraries, { slug: 'Utils', children: utilsLibraries }],
  },
  {
    slug: 'API Reference',
    href: '/docs/libraries',
  },
  {
    slug: 'Manifesto',
    href: '/docs/manifesto',
  },
  {
    slug: 'Contributing',
    href: '/docs/contributing',
  },
  {
    slug: 'Acknowledgments',
    href: '/docs/acknowledgments',
  },
  {
    slug: 'Regarding AI',
    href: '/docs/regarding-ai',
  },
]

/**
 * Formats a navigation item's display title.
 *
 * @param item - The navigation item
 * @param usePackageName - Whether to use the full package name (for mobile) or slug (for desktop)
 * @returns The formatted display title
 */
export function getDisplayTitle(item: NavItem, usePackageName = false): string {
  if (usePackageName && item.packageName) {
    return item.packageName
  }
  return item.slug
}
