import { LibraryStubPage } from '@/components/library-stub-page'

export default function UtilsPage() {
  return (
    <LibraryStubPage
      title="Utils"
      packageName="@hyperfrontend/utils"
      description="A collection of utility sub-packages used across the HyperFrontend library ecosystem. Each sub-package can be imported separately for tree-shaking."
      features={[
        '@hyperfrontend/data-utils — Data transformation utilities',
        '@hyperfrontend/string-utils — String manipulation helpers',
        '@hyperfrontend/list-utils — Array and collection utilities',
        '@hyperfrontend/time-utils — Time and date helpers',
        '@hyperfrontend/random-generator — Secure random value generation',
      ]}
    />
  )
}
