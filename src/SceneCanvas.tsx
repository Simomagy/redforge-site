import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Station } from './scene/roadmap'
import { createWorld } from './scene/world'
import { SITE } from './site'

type Props = {
  progress: RefObject<number>
  readout: RefObject<HTMLElement | null>
  /** The roadmap's stations, laid out in the scene as a railway. */
  stations: Station[]
}

const fmt = (n: number) => (n < 0 ? '-' : '+') + Math.abs(n).toFixed(1).padStart(5, '0')

export function SceneCanvas({ progress, readout, stations }: Props) {
  const world = useRef<ReturnType<typeof createWorld> | null>(null)
  const latest = useRef(stations)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!canvas.current) return
    // `?reduce` forces the reduced-motion scene in dev, to check it without changing the OS setting.
    const reducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (import.meta.env.DEV && location.search.includes('reduce'))
    const mobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches
    let lastText = ''
    try {
      const w = createWorld(canvas.current, {
        reducedMotion,
        mobile,
        progress,
        partner: SITE.partner,
        onFrame: ({ x, y, z, hour }) => {
          const h = Math.floor(hour)
          const m = Math.floor((hour - h) * 60)
          const text = `X ${fmt(x)}  Y ${fmt(y)}  Z ${fmt(z)}  ·  ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
          if (text !== lastText && readout.current) readout.current.textContent = lastText = text
        },
      })
      world.current = w
      w.setRoadmap(latest.current)
      return () => {
        world.current = null
        w.dispose()
      }
    } catch (e) {
      console.error(e)
      setFailed(true)
    }
  }, [progress, readout])

  useEffect(() => {
    latest.current = stations
    world.current?.setRoadmap(stations)
  }, [stations])

  return (
    <div className={failed ? 'scene scene--fallback' : 'scene'} aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  )
}
