import { LibraryDocPage } from '@/components/library-doc-page'

export default function UtilsPage() {
  return (
    <LibraryDocPage
      title="Utils"
      packageName="@hyperfrontend/utils"
      slug="utils"
      category="supporting"
      fallbackDescription="Shared utilities, types, and type guards used across the Hyperfrontend library ecosystem."
      fallbackFeatures={[
        'Noop functions and placeholders',
        'MessageEvent type guard',
        'Error type guards (DOMException, Error)',
        'JSON serialization type guards',
        'Environment detection and common interfaces',
      ]}
    />
  )
}
