import { LibraryDocPage } from '@/components/library-doc-page'

export default function RandomGeneratorUtilsPage() {
  return (
    <LibraryDocPage
      title="Random Generator Utils"
      packageName="@hyperfrontend/random-generator-utils"
      slug="random-generator"
      category="utils"
      fallbackDescription="Random value generation utilities for testing, simulations, and unique ID creation."
      fallbackFeatures={[
        'Secure random number generation',
        'UUID and ULID generation',
        'Random string generators',
        'Seeded random number generators',
      ]}
    />
  )
}
