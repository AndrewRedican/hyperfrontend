import type { ServeConfig } from '../serve-types'

/** One deployed serve config, its two rewrites, and the header lines every form must send for a path. */
export interface DeployedCase {
  /** The shape of the deployment the config stands for. */
  readonly name: string
  /** The request path the rules are folded for. */
  readonly path: string
  /** The config as deployed, every header spelled in a rule. */
  readonly deployed: ServeConfig
  /** The same config with the first rule's policy moved to `embedders`. */
  readonly rewritten: ServeConfig
  /** The rewrite with the three cross-origin headers moved to `isolation` as well. */
  readonly isolated: ServeConfig
  /** The ordered `Name: value` lines the deployed config sends for the path. */
  readonly lines: readonly string[]
}

const SITE_WIDE: ServeConfig = {
  headers: [
    {
      headers: {
        'Content-Security-Policy': "frame-ancestors 'self' https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const SITE_WIDE_REWRITTEN: ServeConfig = {
  embedders: ["'self'", 'https://www.hyperfrontend.dev', 'https://hyperfrontend.dev', 'https://*.vercel.app'],
  headers: [
    {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const SITE_WIDE_ISOLATED: ServeConfig = {
  embedders: ["'self'", 'https://www.hyperfrontend.dev', 'https://hyperfrontend.dev', 'https://*.vercel.app'],
  isolation: 'require-corp',
  headers: [
    { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const DENYING_PREFIX: ServeConfig = {
  headers: [
    {
      headers: {
        'Content-Security-Policy': "frame-ancestors 'self' https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    { prefix: '/host', headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const DENYING_PREFIX_REWRITTEN: ServeConfig = {
  embedders: ["'self'", 'https://www.hyperfrontend.dev', 'https://hyperfrontend.dev', 'https://*.vercel.app'],
  headers: [
    {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    { prefix: '/host', headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const DENYING_PREFIX_ISOLATED: ServeConfig = {
  embedders: ["'self'", 'https://www.hyperfrontend.dev', 'https://hyperfrontend.dev', 'https://*.vercel.app'],
  isolation: 'require-corp',
  headers: [
    { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
    { prefix: '/host', headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const WIDENING_PREFIX: ServeConfig = {
  headers: [
    {
      headers: {
        'Content-Security-Policy': "frame-ancestors 'self' https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    {
      prefix: '/fish-',
      headers: {
        'Content-Security-Policy':
          "frame-ancestors 'self' https://demo-koi-pond-production.up.railway.app https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app",
      },
    },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-angular/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-lit/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-preact/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-react/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-solid/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-svelte/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-vanilla/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-vue/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const WIDENING_PREFIX_REWRITTEN: ServeConfig = {
  embedders: ["'self'", 'https://www.hyperfrontend.dev', 'https://hyperfrontend.dev', 'https://*.vercel.app'],
  headers: [
    {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    {
      prefix: '/fish-',
      headers: {
        'Content-Security-Policy':
          "frame-ancestors 'self' https://demo-koi-pond-production.up.railway.app https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app",
      },
    },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-angular/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-lit/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-preact/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-react/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-solid/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-svelte/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-vanilla/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-vue/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const WIDENING_PREFIX_ISOLATED: ServeConfig = {
  embedders: ["'self'", 'https://www.hyperfrontend.dev', 'https://hyperfrontend.dev', 'https://*.vercel.app'],
  isolation: 'require-corp',
  headers: [
    { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
    {
      prefix: '/fish-',
      headers: {
        'Content-Security-Policy':
          "frame-ancestors 'self' https://demo-koi-pond-production.up.railway.app https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app",
      },
    },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-angular/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-lit/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-preact/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-react/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-solid/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-svelte/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-vanilla/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { prefix: '/fish-vue/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const LEAF: ServeConfig = {
  headers: [
    {
      headers: {
        'Content-Security-Policy':
          "frame-ancestors 'self' https://demo-koi-pond-production.up.railway.app https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const LEAF_REWRITTEN: ServeConfig = {
  embedders: [
    "'self'",
    'https://demo-koi-pond-production.up.railway.app',
    'https://www.hyperfrontend.dev',
    'https://hyperfrontend.dev',
    'https://*.vercel.app',
  ],
  headers: [
    {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const LEAF_ISOLATED: ServeConfig = {
  embedders: [
    "'self'",
    'https://demo-koi-pond-production.up.railway.app',
    'https://www.hyperfrontend.dev',
    'https://hyperfrontend.dev',
    'https://*.vercel.app',
  ],
  isolation: 'require-corp',
  headers: [
    { headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
    { suffix: '.html', headers: { 'Cache-Control': 'public, max-age=60, s-maxage=3600' } },
    { prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  ],
}

const SITE_POLICY =
  "Content-Security-Policy: frame-ancestors 'self' https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app"

const FISH_POLICY =
  "Content-Security-Policy: frame-ancestors 'self' https://demo-koi-pond-production.up.railway.app https://www.hyperfrontend.dev https://hyperfrontend.dev https://*.vercel.app"

const NO_EMBEDDER = "Content-Security-Policy: frame-ancestors 'none'"

const EVERY_PATH = [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Embedder-Policy: require-corp',
  'Cross-Origin-Resource-Policy: cross-origin',
]

const PAGE = 'Cache-Control: public, max-age=60, s-maxage=3600'

const ASSET = 'Cache-Control: public, max-age=31536000, immutable'

const SITE_WIDE_FORMS = { name: 'site-wide', deployed: SITE_WIDE, rewritten: SITE_WIDE_REWRITTEN, isolated: SITE_WIDE_ISOLATED }

const DENYING_PREFIX_FORMS = {
  name: 'denying prefix',
  deployed: DENYING_PREFIX,
  rewritten: DENYING_PREFIX_REWRITTEN,
  isolated: DENYING_PREFIX_ISOLATED,
}

const WIDENING_PREFIX_FORMS = {
  name: 'widening prefix',
  deployed: WIDENING_PREFIX,
  rewritten: WIDENING_PREFIX_REWRITTEN,
  isolated: WIDENING_PREFIX_ISOLATED,
}

const LEAF_FORMS = { name: 'leaf', deployed: LEAF, rewritten: LEAF_REWRITTEN, isolated: LEAF_ISOLATED }

/** Every deployed config paired with each representative path and the lines that path is sent. */
export const DEPLOYED_CASES: readonly DeployedCase[] = [
  { ...SITE_WIDE_FORMS, path: '/index.html', lines: [SITE_POLICY, ...EVERY_PATH, PAGE] },
  { ...SITE_WIDE_FORMS, path: '/assets/index-1a2b.js', lines: [SITE_POLICY, ...EVERY_PATH, ASSET] },
  { ...SITE_WIDE_FORMS, path: '/favicon.ico', lines: [SITE_POLICY, ...EVERY_PATH] },
  { ...SITE_WIDE_FORMS, path: '/missing', lines: [SITE_POLICY, ...EVERY_PATH] },
  { ...DENYING_PREFIX_FORMS, path: '/index.html', lines: [SITE_POLICY, ...EVERY_PATH, PAGE] },
  { ...DENYING_PREFIX_FORMS, path: '/assets/index-1a2b.js', lines: [SITE_POLICY, ...EVERY_PATH, ASSET] },
  { ...DENYING_PREFIX_FORMS, path: '/favicon.ico', lines: [SITE_POLICY, ...EVERY_PATH] },
  { ...DENYING_PREFIX_FORMS, path: '/missing', lines: [SITE_POLICY, ...EVERY_PATH] },
  { ...DENYING_PREFIX_FORMS, path: '/host/index.html', lines: [NO_EMBEDDER, ...EVERY_PATH, PAGE] },
  { ...DENYING_PREFIX_FORMS, path: '/host/assets/host-1a2b.js', lines: [NO_EMBEDDER, ...EVERY_PATH] },
  { ...WIDENING_PREFIX_FORMS, path: '/index.html', lines: [SITE_POLICY, ...EVERY_PATH, PAGE] },
  { ...WIDENING_PREFIX_FORMS, path: '/assets/index-1a2b.js', lines: [SITE_POLICY, ...EVERY_PATH, ASSET] },
  { ...WIDENING_PREFIX_FORMS, path: '/favicon.ico', lines: [SITE_POLICY, ...EVERY_PATH] },
  { ...WIDENING_PREFIX_FORMS, path: '/missing', lines: [SITE_POLICY, ...EVERY_PATH] },
  { ...WIDENING_PREFIX_FORMS, path: '/fish-vue/index.html', lines: [FISH_POLICY, ...EVERY_PATH, PAGE] },
  { ...WIDENING_PREFIX_FORMS, path: '/fish-vue/assets/index-1a2b.js', lines: [FISH_POLICY, ...EVERY_PATH, ASSET] },
  { ...WIDENING_PREFIX_FORMS, path: '/fish-vue/favicon.ico', lines: [FISH_POLICY, ...EVERY_PATH] },
  { ...LEAF_FORMS, path: '/index.html', lines: [FISH_POLICY, ...EVERY_PATH, PAGE] },
  { ...LEAF_FORMS, path: '/assets/index-1a2b.js', lines: [FISH_POLICY, ...EVERY_PATH, ASSET] },
  { ...LEAF_FORMS, path: '/missing', lines: [FISH_POLICY, ...EVERY_PATH] },
]
