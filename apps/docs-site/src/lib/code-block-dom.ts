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
 * Light code blocks from wherever the pointer is, and tip them towards it.
 *
 * One listener for the whole document rather than one per block, because a
 * reference page can hold dozens of samples and the effect is worth nothing if
 * it costs something on each of them. Nothing is measured until the pointer is
 * actually inside a block, and the block is left alone again the moment the
 * pointer leaves it, so a page nobody is pointing at runs no code at all.
 *
 * What is written is two numbers, each between zero and one, saying where in
 * the block's own box the pointer is. Everything the reader sees is the
 * stylesheet's doing from there: the wash, its trailing companion, the rim
 * that brightens on the pointer's side, and the fraction of a degree each
 * decorative layer is tipped by. None of them is the block itself, so the code
 * does not move, the selection does not shift, and the copy control stays
 * where it was aimed.
 *
 * There is no interpolation here either. The numbers are transitioned by the
 * stylesheet, so this sets a target and stops; the lag a reader feels is the
 * transition still running after the pointer has moved on.
 *
 * @returns A function that removes the listeners and clears any lit block.
 * @example Lighting every block on the page for as long as it is mounted
 * ```ts
 * useEffect(() => attachPointerLight(), [])
 * ```
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

  const aim = (block: HTMLElement, clientX: number, clientY: number): void => {
    const box = block.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) {
      return
    }
    block.style.setProperty('--code-x', ((clientX - box.left) / box.width).toFixed(4))
    block.style.setProperty('--code-y', ((clientY - box.top) / box.height).toFixed(4))
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
        // why: the light is aimed before the transition that lags it is switched on, so a block lights up where the pointer entered instead of swinging in from its centre
        aim(block, clientX, clientY)
        release()
        lit = block
        block.classList.add(LIT_CLASS)
        return
      }
      aim(block, clientX, clientY)
    })
  }

  // why: a pointer that leaves through the edge of the window sends no further move, so without this the last block a reader touched stays lit behind them
  const onLeave = (): void => release()

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerleave', onLeave, { passive: true })
  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
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
