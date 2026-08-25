import type { GuideIndexEntry } from '../../scripts/generate-guides.types'

/**
 * One document type as the guides index presents it: the chip that filters to
 * it, the heading its group carries, and the promise that group makes.
 */
export interface GuideTypeGroup {
  /** The `type` facet value, as it appears in the URL and in the corpus index */
  value: GuideIndexEntry['type']
  /** Filter chip label */
  chip: string
  /** Group heading */
  heading: string
  /** One line naming what this type promises a reader */
  description: string
}

/**
 * The document types the corpus can hold, in reading order. Tutorials and
 * how-to guides are different promises to the reader, so they never merge
 * into one list.
 */
export const GUIDE_TYPE_GROUPS: readonly GuideTypeGroup[] = [
  { value: 'tutorial', chip: 'Tutorials', heading: 'Tutorials', description: 'Learning-oriented: build something real, step by step.' },
  {
    value: 'how-to',
    chip: 'How-to',
    heading: 'How-to guides',
    description: 'Goal-oriented: solve a specific problem with a working result.',
  },
  {
    value: 'troubleshooting',
    chip: 'Troubleshooting',
    heading: 'Troubleshooting',
    description: 'Diagnosis-oriented: work out why HyperFrontend is not behaving as documented.',
  },
  { value: 'recipe', chip: 'Recipes', heading: 'Recipes', description: 'Short, copyable answers to a narrow question.' },
]

/**
 * Shorten a package name for display inside the guides index, where every
 * package shares one npm scope and repeating it spends a reader's attention
 * on the part that never varies.
 *
 * @param packageName - Full npm package name, e.g. `@hyperfrontend/nexus`
 * @returns The name without the shared scope, e.g. `nexus`
 */
export function shortPackageName(packageName: string): string {
  return packageName.replace('@hyperfrontend/', '')
}
