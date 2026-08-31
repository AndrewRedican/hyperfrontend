import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe } from '@hyperfrontend/testing'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './deploy-static-headers'

const manager = createTempWorkspaceManager()

/** A serve config that names its permitted ancestors on an unbounded rule. */
const VALID_SERVE_CONFIG = {
  headers: [{ headers: { 'Content-Security-Policy': "frame-ancestors 'self' https://hyperfrontend.dev" } }],
}

/**
 * Stages a project.json, optionally beside a `public/hf-serve.config.json`, and
 * returns the path the rule tester should lint.
 *
 * @param projectJson - The project.json content to write.
 * @param serveConfig - The serve config to write, omitted to stage no config at all.
 * @returns The absolute path of the staged project.json.
 */
function stage(projectJson: object, serveConfig?: object): string {
  const files: Record<string, string> = {
    'nx.json': JSON.stringify({ version: 2 }, null, 2),
    'apps/demos/thing/project.json': JSON.stringify(projectJson, null, 2),
  }
  if (serveConfig !== undefined) {
    files['apps/demos/thing/public/hf-serve.config.json'] = JSON.stringify(serveConfig, null, 2)
  }
  return join(manager.create({ files }).root, 'apps', 'demos', 'thing', 'project.json')
}

/**
 * Builds a static-deploy project.json carrying the given name.
 *
 * @param name - The project name, omitted to stage a project.json without one.
 * @returns The project.json content.
 */
function staticProject(name: string | null = 'demo-thing'): object {
  return {
    ...(name === null ? {} : { name }),
    projectType: 'application',
    metadata: { deploy: { provider: 'railway', kind: 'static' } },
  }
}

/**
 * Builds a static-deploy project.json paired with a serve config declaring the
 * given policy on an unbounded rule.
 *
 * @param policy - The Content-Security-Policy value to declare.
 * @returns The staged project.json path.
 */
function stageWithPolicy(policy: string): string {
  return stage(staticProject(), { headers: [{ headers: { 'Content-Security-Policy': policy } }] })
}

const ruleTester = createJsonRuleTester()

describe('deploy-static-headers', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('deploy-static-headers', rule, {
    valid: [
      {
        name: 'passes when a static deploy ships a config naming its ancestors',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), VALID_SERVE_CONFIG),
      },
      {
        name: 'accepts a Content-Security-Policy header spelled in another case',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), { headers: [{ headers: { 'content-security-policy': "frame-ancestors 'none'" } }] }),
      },
      {
        name: 'accepts a bounded rule narrowing the policy beside an unbounded one',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), {
          headers: [
            { headers: { 'Content-Security-Policy': "frame-ancestors 'self'" } },
            { prefix: '/host', headers: { 'Content-Security-Policy': "frame-ancestors 'none'" } },
          ],
        }),
      },
      {
        name: 'accepts a policy declaring other directives alongside frame-ancestors',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stageWithPolicy("default-src 'self'; frame-ancestors 'self'; img-src *"),
      },
      {
        name: 'skips a project declaring no deploy metadata',
        code: JSON.stringify({ name: 'demo-planned', projectType: 'application' }, null, 2),
        filename: stage({ name: 'demo-planned', projectType: 'application' }),
      },
      {
        name: 'skips a project whose metadata carries no deploy block',
        code: JSON.stringify({ name: 'demo-lib', metadata: { lifecycle: { state: 'frozen' } } }, null, 2),
        filename: stage({ name: 'demo-lib', metadata: { lifecycle: { state: 'frozen' } } }),
      },
      {
        name: 'skips a deploy block declaring no kind',
        code: JSON.stringify({ name: 'demo-thing', metadata: { deploy: { provider: 'railway' } } }, null, 2),
        filename: stage({ name: 'demo-thing', metadata: { deploy: { provider: 'railway' } } }),
      },
      {
        name: 'skips a deploy kind that does not go through hf serve',
        code: JSON.stringify({ name: 'demo-api', metadata: { deploy: { kind: 'container' } } }, null, 2),
        filename: stage({ name: 'demo-api', metadata: { deploy: { kind: 'container' } } }),
      },
      {
        name: 'skips a project whose metadata is not an object',
        code: JSON.stringify({ name: 'demo-thing', metadata: 'static' }, null, 2),
        filename: stage({ name: 'demo-thing', metadata: 'static' }),
      },
      {
        name: 'skips a project whose deploy block is not an object',
        code: JSON.stringify({ name: 'demo-thing', metadata: { deploy: 'static' } }, null, 2),
        filename: stage({ name: 'demo-thing', metadata: { deploy: 'static' } }),
      },
    ],
    invalid: [
      {
        name: 'reports a static deploy shipping no serve config',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject()),
        errors: [
          {
            messageId: 'missingServeConfig',
            data: { projectName: 'demo-thing', configPath: join('public', 'hf-serve.config.json') },
          },
        ],
      },
      {
        name: 'names the directory when the project.json declares no name',
        code: JSON.stringify(staticProject(null), null, 2),
        filename: stage(staticProject(null)),
        errors: [{ messageId: 'missingServeConfig' }],
      },
      {
        name: 'reports a serve config declaring no header rules',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), {}),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'reports when every rule is bounded by a prefix',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), {
          headers: [{ prefix: '/embed', headers: { 'Content-Security-Policy': "frame-ancestors 'self'" } }],
        }),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'reports when every rule is bounded by a suffix',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), {
          headers: [{ suffix: '.html', headers: { 'Content-Security-Policy': "frame-ancestors 'self'" } }],
        }),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'reports an unbounded rule setting no headers at all',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), { headers: [{}] }),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'reports an unbounded rule setting headers other than the policy',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stage(staticProject(), { headers: [{ headers: { 'X-Content-Type-Options': 'nosniff' } }] }),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'reports a policy declaring no frame-ancestors directive',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stageWithPolicy("default-src 'self'"),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'reports a frame-ancestors directive naming no sources',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stageWithPolicy("default-src 'self'; frame-ancestors"),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'tolerates an empty trailing directive while still reporting the missing policy',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stageWithPolicy("default-src 'self';"),
        errors: [{ messageId: 'missingFrameAncestors' }],
      },
      {
        name: 'reports a policy permitting every origin',
        code: JSON.stringify(staticProject(), null, 2),
        filename: stageWithPolicy('frame-ancestors *'),
        errors: [
          {
            messageId: 'permissiveFrameAncestors',
            data: { configPath: join('public', 'hf-serve.config.json'), directive: 'frame-ancestors' },
          },
        ],
      },
    ],
  })
})
