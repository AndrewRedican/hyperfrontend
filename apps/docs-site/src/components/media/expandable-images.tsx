'use client'

import type { ExpandableImage } from '@/lib/expandable-images'
import type { LightboxMedia } from './media-lightbox'
import { attachExpandableImages } from '@/lib/expandable-images'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MediaLightbox } from './media-lightbox'

/**
 * Lets any picture in rendered prose be inspected at its native size.
 *
 * Mounted once in the root layout rather than by each page that shows
 * pictures, because the pictures are written into pages three different
 * ways here (a rendered README, a rendered guide, a rendered article) and
 * none of them should have to remember to opt in. It marks the images that
 * carry more detail than the column shows, and opens the one the reader
 * activates in the same lightbox a diagram expands into. A picture drawn at
 * its own size, an icon, a badge, or an image that is already a link is
 * left exactly as it was.
 * @returns The lightbox, when one is open; otherwise nothing.
 */
export function ExpandableImages() {
  const [open, setOpen] = useState<ExpandableImage | null>(null)

  useEffect(() => attachExpandableImages(setOpen), [])

  const close = useCallback(() => setOpen(null), [])
  const media = useMemo((): LightboxMedia | null => (open === null ? null : { kind: 'image', ...open }), [open])

  if (media === null || open === null) return null
  return <MediaLightbox media={media} label={open.alt === '' ? 'Expanded image' : `Expanded image: ${open.alt}`} isOpen onClose={close} />
}
