import { LibraryDocPage } from '@/components/library-doc-page'

export default function ProjectScopePage() {
  return (
    <LibraryDocPage
      title="Project Scope"
      packageName="@hyperfrontend/project-scope"
      slug="project-scope"
      category="core"
      fallbackDescription="Comprehensive project analysis, technology stack detection, and transactional virtual file system for Node.js tooling."
      fallbackFeatures={[
        'Project classification with confidence scoring and evidence tracking',
        'Technology detection for 20+ frameworks (React, Vue, Angular, Svelte) and build tools',
        'Virtual file system with transaction-aware atomic commit/rollback operations',
        'Monorepo intelligence for NX, Turborepo, Lerna, and workspace detection',
        'Dependency graph building with root/leaf node identification',
        'Entry point discovery from package.json exports, bin fields, and conventions',
        'CLI interface with JSON/YAML output support',
      ]}
    />
  )
}
