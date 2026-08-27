import { defineRailway, github, project, service } from 'railway/iac'

export default defineRailway(() => {
  const hyperfrontend = github('AndrewRedican/hyperfrontend', { checkSuites: true, rootDirectory: '/' })

  const koiVue = service('koi vue', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-vue',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/lib/**', '/apps/demos/koi-pond/fish-vue/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-vue --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'exquisite-caring' },
  })
  const koiPond = service('koi-pond', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx run-many -t build -p demo-koi-pond demo-koi-fish-*',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/host/**', '/apps/demos/koi-pond/lib/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
  })
  const heartbeat = service('heartbeat', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-heartbeat',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/heartbeat/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/heartbeat/app --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    deploy: { preDeployCommand: [] },
  })
  const koiAngular = service('koi-angular', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-angular',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/lib/**', '/apps/demos/koi-pond/fish-angular/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-angular --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
  })
  const koiSolid = service('koi solid', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-solid',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/lib/**', '/apps/demos/koi-pond/fish-solid/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-solid --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'diplomatic-radiance' },
  })
  const koiLit = service('koi lit', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-lit',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/lib/**', '/apps/demos/koi-pond/fish-lit/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-lit --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'striking-kindness' },
  })
  const koiPreact = service('koi-preact', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-preact',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/lib/**', '/apps/demos/koi-pond/fish-preact/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-preact --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'pure-presence' },
  })
  const clock = service('clock', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-clock',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/clock/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/clock/app --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    deploy: { limitOverride: { containers: { cpu: 4, memoryBytes: 4000000000 } }, preDeployCommand: [] },
    networking: { privateNetworkEndpoint: 'demo-clock' },
  })
  const koiSvelte = service('koi svelte', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-svelte',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/lib/**', '/apps/demos/koi-pond/fish-svelte/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-svelte --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'peaceful-flow' },
  })
  const koiReact = service('koi react', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-react',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/lib/**', '/apps/demos/koi-pond/fish-react/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-react --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'remarkable-amazement' },
  })
  const koiVanilla = service('koi-vanilla', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npx nx build demo-koi-fish-vanilla',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: ['/apps/demos/koi-pond/fish-vanilla/**', '/apps/demos/koi-pond/lib/**'],
    },
    start: 'npx -y @hyperfrontend/features@0.7.0 serve --root dist/apps/demos/koi-pond/site/fish-vanilla --host 0.0.0.0 --port $PORT',
    healthcheck: '/',
    replicas: { 'europe-west4-drams3a': 1 },
  })

  return project('hyperfrontend', {
    resources: [koiVue, koiPond, heartbeat, koiAngular, koiSolid, koiLit, koiPreact, clock, koiSvelte, koiReact, koiVanilla],
  })
})
