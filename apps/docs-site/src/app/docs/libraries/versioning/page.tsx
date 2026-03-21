import { LibraryDocPage } from '@/components/library-doc-page'

export default function VersioningPage() {
  return (
    <LibraryDocPage
      title="Versioning"
      packageName="@hyperfrontend/versioning"
      slug="versioning"
      category="supporting"
      fallbackDescription="Versioning library with changelog parsing, conventional commits, and semver flow orchestration."
      fallbackFeatures={[
        'Parse CHANGELOG.md files into structured objects with lossless round-tripping',
        'Parse conventional commit messages following the Conventional Commits specification',
        'Semantic version parsing, comparison, and increment utilities',
        'npm registry client for querying published versions and package metadata',
        'Monorepo scope filtering for intelligent commit classification',
        'Zero external runtime dependencies',
      ]}
    />
  )
}
