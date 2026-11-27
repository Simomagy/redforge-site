import { useEffect, useRef, useState } from 'react'

/**
 * Turns the scroll position into a fractional chapter index: k when chapter k
 * is centred in the viewport, k + 0.5 half way to the next one.
 */
export function useChapterProgress(selector: string) {
  const progress = useRef(0)
  const [active, setActive] = useState(0)

  useEffect(() => {
    let centres: number[] = []
    const measure = () => {
      const vh = window.innerHeight
      const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
      centres = els.map((el, i) => {
        const top = el.getBoundingClientRect().top + window.scrollY
        if (i === 0 || i === els.length - 1) return top + vh / 2
        return top + el.offsetHeight / 2
      })
      update()
    }
    const update = () => {
      const y = window.scrollY + window.innerHeight / 2
      let f = 0
      for (let k = 0; k < centres.length - 1; k++) {
        if (y >= centres[k]) f = k + Math.min(1, (y - centres[k]) / (centres[k + 1] - centres[k]))
      }
      if (!Number.isFinite(f)) f = 0
      progress.current = f
      setActive(Math.round(f))
    }
    measure()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', measure)
      ro.disconnect()
    }
  }, [selector])

  return { progress, active }
}
