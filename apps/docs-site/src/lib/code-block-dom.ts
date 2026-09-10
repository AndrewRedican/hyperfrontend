/** Class the stylesheet paints the pointer light for. */
const LIT_CLASS = 'is-lit'

/** Class the language label is drawn with. */
const LANGUAGE_CLASS = 'code-language'

/** Prefix Shiki writes the fenced language under. */
const LANGUAGE_PREFIX = 'language-'

/** Languages worth naming. A block fenced as plain text has nothing to say. */
const UNNAMED_LANGUAGES: readonly string[] = ['text', 'plaintext', 'txt', 'ansi']

/**
 * Whether this visitor should get the pointer light at all.
 *
 * Two conditions, both about the visitor rather than the page. A coarse pointer
 * has no hover to speak of, so the light would either never appear or appear
 * stuck wherever a finger last touched. And a visitor who has asked for less
 * motion has asked for exactly this: the light is the only thing on a code
 * block that moves.
 *
 * @returns True when the effect is wanted here.
 */
function wantsPointerLight(): boolean {
  return window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Light code blocks from wherever the pointer is.
 *
 * One listener for the whole document rather than one per block, because a
 * reference page can hold dozens of samples and the effect is worth nothing if
 * it costs something on each of them. Nothing is measured until the pointer is
 * actually inside a block, the position is written as two custom properties the
 * stylesheet reads, and the block is left alone again the moment the pointer
 * leaves it.
 *
 * @returns A function that removes the listener and clears any lit block.
 */
export function attachPointerLight(): () => void {
  if (!wantsPointerLight()) {
    return () => undefined
  }
  let lit: HTMLElement | null = null
  let pending = 0

  const release = (): void => {
    lit?.classList.remove(LIT_CLASS)
    lit = null
  }

  const paint = (block: HTMLElement, clientX: number, clientY: number): void => {
    const box = block.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) {
      return
    }
    block.style.setProperty('--code-x', `${(((clientX - box.left) / box.width) * 100).toFixed(2)}%`)
    block.style.setProperty('--code-y', `${(((clientY - box.top) / box.height) * 100).toFixed(2)}%`)
  }

  const onMove = (event: PointerEvent): void => {
    if (pending !== 0) {
      return
    }
    const { clientX, clientY, target } = event
    pending = window.requestAnimationFrame(() => {
      pending = 0
      const block = target instanceof Element ? target.closest<HTMLElement>('pre.shiki') : null
      if (block === null) {
        release()
        return
      }
      if (block !== lit) {
        // why: the light is placed before it is shown, so a block never lights up at its centre and then jumps to the cursor
        paint(block, clientX, clientY)
        release()
        lit = block
        block.classList.add(LIT_CLASS)
        return
      }
      paint(block, clientX, clientY)
    })
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  return () => {
    document.removeEventListener('pointermove', onMove)
    if (pending !== 0) {
      window.cancelAnimationFrame(pending)
    }
    release()
  }
}

/**
 * Read the language a block was fenced with.
 *
 * The class is written onto the inner `<code>` rather than the `<pre>`, which
 * is where the highlighter puts it and not where a reader of the stylesheet
 * would guess, so the lookup goes through the child rather than the block.
 *
 * @param block - A highlighted code block.
 * @returns The language id, or an empty string when there is none worth showing.
 */
function readLanguage(block: HTMLElement): string {
  const code = block.querySelector('code')
  for (const name of code?.classList ?? block.classList) {
    if (name.startsWith(LANGUAGE_PREFIX)) {
      const language = name.slice(LANGUAGE_PREFIX.length)
      return UNNAMED_LANGUAGES.includes(language) ? '' : language
    }
  }
  return ''
}

/**
 * Name each code block with the language it was fenced with.
 *
 * A sample that could be a shell command or a TypeScript expression is two
 * different instructions, and the fence already says which. The label is
 * decorative markup rather than content: it is hidden from assistive
 * technology, because the code is announced as code either way and a stray
 * "typescript" read out before every sample is noise.
 *
 * @param container - A rendered prose container.
 * @returns A function that removes every label it added.
 */
export function injectLanguageLabels(container: HTMLElement): () => void {
  const added: HTMLElement[] = []
  for (const block of container.querySelectorAll<HTMLElement>('pre.shiki')) {
    if (block.querySelector(`.${LANGUAGE_CLASS}`) !== null) {
      continue
    }
    const language = readLanguage(block)
    if (language === '') {
      continue
    }
    const label = document.createElement('span')
    label.className = LANGUAGE_CLASS
    label.setAttribute('aria-hidden', 'true')
    label.textContent = language
    block.appendChild(label)
    added.push(label)
  }
  return () => {
    for (const label of added) {
      label.remove()
    }
  }
}
