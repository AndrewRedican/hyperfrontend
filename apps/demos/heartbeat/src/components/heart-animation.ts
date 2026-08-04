/**
 * Per-beat animation driver for the anatomical heart.
 *
 * Each beat is played from JavaScript (not an infinite CSS loop) because the
 * rhythm's timing varies — jitter, user extras, compensatory pauses, and the
 * recovery ramp all move the next beat.
 */

/**
 * Plays one multi-stage contraction across the heart's layers.
 *
 * The stages mirror the cardiac cycle: the atria band kicks first, then the
 * ventricular mass squeezes with a slight apex twist while the white backing
 * flexes underneath, and finally the aorta and vena cava take the pulse. Under
 * reduced motion the whole cycle collapses to a gentle fade.
 *
 * @param svg - The heart SVG root containing the stage groups.
 */
export function playBeat(svg: SVGSVGElement): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    svg.animate([{ opacity: 1 }, { opacity: 0.75 }, { opacity: 1 }], { duration: 340, easing: 'ease-in-out' })
    return
  }
  svg
    .querySelector('.hb-atria')
    ?.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.94)', offset: 0.5 }, { transform: 'scale(1)' }], {
      duration: 110,
      easing: 'ease-out',
    })
  svg
    .querySelector('.hb-ventricles')
    ?.animate(
      [
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(0.92) rotate(-2.5deg)', offset: 0.4 },
        { transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: 250, delay: 90, easing: 'cubic-bezier(0.33, 0, 0.2, 1)' }
    )
  svg
    .querySelector('.hb-backing')
    ?.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.975)', offset: 0.4 }, { transform: 'scale(1)' }], {
      duration: 250,
      delay: 90,
      easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
    })
  svg
    .querySelector('.hb-aorta')
    ?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.5 }, { transform: 'scale(1)' }], {
      duration: 220,
      delay: 110,
      easing: 'ease-in-out',
    })
  svg
    .querySelector('.hb-cava')
    ?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)', offset: 0.55 }, { transform: 'scale(1)' }], {
      duration: 240,
      delay: 130,
      easing: 'ease-in-out',
    })
}
