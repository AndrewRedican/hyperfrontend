import { defineRailway, github, project, service } from 'railway/iac'

export default defineRailway(() => {
  // why: the pipeline's provision task applies this file to production before any deploy of a main run (tools/workspace/scripts/railway-provision.mjs); a destructive change is left to an apply by hand
  // why: the owned pipeline deploys each demo itself, from the commit it checked, once the demo's own tasks have passed (tools/workspace/scripts/railway-deploy.mjs); Wait for CI stays off so that deploy never waits on the check suite of the run requesting it
  const hyperfrontend = github('AndrewRedican/hyperfrontend', { checkSuites: false, rootDirectory: '/' })
  // why: a push trigger cannot be switched off in the file, so every service watches a path no commit touches and Railway never queues a build of its own
  const pipelineOwned = ['/.railway/pipeline-deploys/**']

  const koiVue = service('koi-vue', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-vue',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-vue --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'exquisite-caring' },
  })
  const koiPond = service('koi-pond', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-pond,demo-koi-fish-*',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
  })
  const heartbeat = service('heartbeat', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-heartbeat',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/heartbeat/app --host 0.0.0.0',
    healthcheck: '/',
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } }, preDeployCommand: [] },
  })
  const koiAngular = service('koi-angular', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-angular',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-angular --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
  })
  const koiSolid = service('koi-solid', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-solid',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-solid --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'diplomatic-radiance' },
  })
  const koiLit = service('koi-lit', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-lit',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-lit --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'striking-kindness' },
  })
  const koiPreact = service('koi-preact', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-preact',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-preact --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'pure-presence' },
  })
  const clock = service('clock', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-clock',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/clock/app --host 0.0.0.0',
    healthcheck: '/',
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } }, preDeployCommand: [] },
    networking: { privateNetworkEndpoint: 'demo-clock' },
  })
  const koiSvelte = service('koi-svelte', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-svelte',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-svelte --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'peaceful-flow' },
  })
  const koiReact = service('koi-react', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-react',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-react --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: 'remarkable-amazement' },
  })
  const koiVanilla = service('koi-vanilla', {
    source: hyperfrontend,
    build: {
      buildCommand: 'npm i && npm run hf -- run-many -t build -p demo-koi-fish-vanilla',
      buildEnvironment: 'V3',
      builder: 'RAILPACK',
      watchPatterns: pipelineOwned,
    },
    start: 'npx -y @hyperfrontend/features@0.11.5 serve --root dist/apps/demos/koi-pond/site/fish-vanilla --host 0.0.0.0',
    healthcheck: '/',
    deploy: { limitOverride: { containers: { cpu: 1, memoryBytes: 2000000000 } } },
    cdn: { enabled: true },
    replicas: { 'europe-west4-drams3a': 1 },
  })

  return project('hyperfrontend', {
    resources: [koiVue, koiPond, heartbeat, koiAngular, koiSolid, koiLit, koiPreact, clock, koiSvelte, koiReact, koiVanilla],
  })
})
