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
  { slug: 'cryptography', packageName: '@hyperfrontend/cryptography', href: '/docs/libraries/cryptography' },
  { slug: 'nexus', packageName: '@hyperfrontend/nexus', href: '/docs/libraries/nexus' },
  {
    slug: 'network-protocol',
    packageName: '@hyperfrontend/network-protocol',
    href: '/docs/libraries/network-protocol',
    children: [
      { slug: 'browser', href: '/docs/libraries/network-protocol/browser' },
      { slug: 'channel', href: '/docs/libraries/network-protocol/channel' },
      { slug: 'data', href: '/docs/libraries/network-protocol/data' },
      { slug: 'node', href: '/docs/libraries/network-protocol/node' },
      { slug: 'packet', href: '/docs/libraries/network-protocol/packet' },
      { slug: 'protocol', href: '/docs/libraries/network-protocol/protocol' },
      { slug: 'queue', href: '/docs/libraries/network-protocol/queue' },
      { slug: 'receiver', href: '/docs/libraries/network-protocol/receiver' },
      { slug: 'routing', href: '/docs/libraries/network-protocol/routing' },
      { slug: 'security', href: '/docs/libraries/network-protocol/security' },
      { slug: 'sender', href: '/docs/libraries/network-protocol/sender' },
      { slug: 'topic', href: '/docs/libraries/network-protocol/topic' },
    ],
  },
  {
    slug: 'project-scope',
    packageName: '@hyperfrontend/project-scope',
    href: '/docs/libraries/project-scope',
    children: [
      { slug: 'cli', href: '/docs/libraries/project-scope/cli' },
      { slug: 'core', href: '/docs/libraries/project-scope/core' },
      { slug: 'heuristics', href: '/docs/libraries/project-scope/heuristics' },
      { slug: 'models', href: '/docs/libraries/project-scope/models' },
      { slug: 'nx', href: '/docs/libraries/project-scope/nx' },
      { slug: 'project', href: '/docs/libraries/project-scope/project' },
      { slug: 'tech', href: '/docs/libraries/project-scope/tech' },
      { slug: 'vfs', href: '/docs/libraries/project-scope/vfs' },
    ],
  },
]

/**
 * Supporting library navigation items.
 * Listed alphabetically for consistency.
 */
const supportingLibraries: NavItem[] = [
  { slug: 'logging', packageName: '@hyperfrontend/logging', href: '/docs/libraries/logging' },
  { slug: 'state-machine', packageName: '@hyperfrontend/state-machine', href: '/docs/libraries/state-machine' },
  {
    slug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    href: '/docs/libraries/versioning',
    children: [
      { slug: 'changelog', href: '/docs/libraries/versioning/changelog' },
      {
        slug: 'commits',
        href: '/docs/libraries/versioning/commits',
        children: [{ slug: 'classify', href: '/docs/libraries/versioning/commits/classify' }],
      },
      { slug: 'flow', href: '/docs/libraries/versioning/flow' },
      { slug: 'git', href: '/docs/libraries/versioning/git' },
      { slug: 'registry', href: '/docs/libraries/versioning/registry' },
      { slug: 'repository', href: '/docs/libraries/versioning/repository' },
      { slug: 'semver', href: '/docs/libraries/versioning/semver' },
      { slug: 'workspace', href: '/docs/libraries/versioning/workspace' },
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
  { slug: 'immutable-api-utils', packageName: '@hyperfrontend/immutable-api-utils', href: '/docs/libraries/utils/immutable-api' },
  { slug: 'json-utils', packageName: '@hyperfrontend/json-utils', href: '/docs/libraries/utils/json' },
  { slug: 'list-utils', packageName: '@hyperfrontend/list-utils', href: '/docs/libraries/utils/list' },
  { slug: 'random-generator-utils', packageName: '@hyperfrontend/random-generator-utils', href: '/docs/libraries/utils/random-generator' },
  { slug: 'string-utils', packageName: '@hyperfrontend/string-utils', href: '/docs/libraries/utils/string' },
  { slug: 'time-utils', packageName: '@hyperfrontend/time-utils', href: '/docs/libraries/utils/time' },
  { slug: 'ui-utils', packageName: '@hyperfrontend/ui-utils', href: '/docs/libraries/utils/ui' },
]

/**
 * Plugin navigation items.
 */
const plugins: NavItem[] = [{ slug: 'features', packageName: '@hyperfrontend/features', href: '/docs/plugins/features' }]

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
    slug: 'Plugins',
    children: plugins,
  },
  {
    slug: 'API Reference',
    href: '/docs/libraries',
  },
  {
    slug: 'Contributing',
    href: '/docs/contributing',
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
