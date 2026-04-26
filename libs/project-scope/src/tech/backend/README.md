# backend

Backend-framework detectors for Node.js HTTP frameworks.

Covers Express, NestJS, Fastify, Koa, and Hono. Each individual detector (`expressDetector`, `nestDetector`, `fastifyDetector`, `koaDetector`, `honoDetector`) follows the shared `BackendDetector` shape and produces a `BackendDetection` with `confidence` and `evidence`. `detectBackendFrameworks` runs them all against a project and returns the aggregate. Used by the cross-cutting `heuristics/framework` module to assemble the full stack picture.
