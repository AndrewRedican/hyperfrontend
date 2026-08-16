import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('questions')
}

export default function QuestionsPage() {
  return (
    <LibraryDocPage
      title="Questions"
      packageName="@hyperfrontend/questions"
      slug="questions"
      category="supporting"
      fallbackDescription="Terminal prompting library with composable, functional API for text, select, confirm, and multiselect prompts."
      fallbackFeatures={[
        'Pure function prompts returning Promise<PromptOutcome<T>> for predictable, testable results',
        'Composable API for building complex interactive CLI flows',
        'Full TypeScript support with discriminated unions for prompt outcomes',
        'Zero external dependencies: uses only Node.js built-ins and @hyperfrontend utilities',
        'Searchable multiselect with type-to-filter functionality for large option lists',
      ]}
    />
  )
}
