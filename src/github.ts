import { useEffect, useState } from 'react'
import snapshot from './github.snapshot.json'

const REPO = 'Simomagy/RedForge'
const CACHE_KEY = 'redforge-github'
/** GitHub allows 60 anonymous requests an hour per address: ask at most this often. */
const CACHE_MS = 20 * 60 * 1000

export type Milestone = {
  title: string
  description: string
  open: number
  closed: number
  url: string
}

export type GitHubData = {
  fetchedAt: string
  version: string
  milestones: Milestone[]
}

/** One stop of the roadmap: "2.7", "Navmesh: polygons and attributes", 0 of 4 done. */
export type Stop = {
  version: string
  name: string
  description: string
  done: number
  total: number
  url: string
}

const versionKey = (v: string) => v.split('.').map(Number)

export function toStops(milestones: Milestone[]): Stop[] {
  return milestones
    .map((m) => {
      // Milestones are titled "2.7 — Navmesh: polygons and attributes".
      const [version, ...rest] = m.title.split(/\s+[—–-]\s+/)
      return {
        version: version.trim(),
        name: rest.join(' - ').trim() || m.title,
        description: m.description,
        done: m.closed,
        total: m.open + m.closed,
        url: m.url,
      }
    })
    .sort((a, b) => {
      const [x, y] = [versionKey(a.version), versionKey(b.version)]
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] || 0) - (y[i] || 0)
        if (d) return d
      }
      return 0
    })
}

async function fetchLive(): Promise<GitHubData> {
  const get = async (path: string) => {
    const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`${path}: ${res.status}`)
    return res.json()
  }
  const [release, milestones] = await Promise.all([
    get('releases/latest'),
    get('milestones?state=open&per_page=100'),
  ])
  return {
    fetchedAt: new Date().toISOString(),
    version: String(release.tag_name).replace(/^v/, ''),
    milestones: (milestones as Record<string, unknown>[]).map((m) => ({
      title: String(m.title),
      description: String(m.description ?? ''),
      open: Number(m.open_issues),
      closed: Number(m.closed_issues),
      url: String(m.html_url),
    })),
  }
}

function cached(): GitHubData | null {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as GitHubData | null
    return data && data.version && Array.isArray(data.milestones) ? data : null
  } catch {
    return null
  }
}

/**
 * The latest release and the roadmap, straight from GitHub: what the build
 * knew at first, then what GitHub says now.
 */
export function useGitHub() {
  const [data, setData] = useState<GitHubData>(() => {
    const c = cached()
    return c && c.fetchedAt > snapshot.fetchedAt ? c : snapshot
  })
  const [live, setLive] = useState(false)

  useEffect(() => {
    const c = cached()
    if (c && Date.now() - Date.parse(c.fetchedAt) < CACHE_MS) {
      setLive(true)
      return
    }
    let gone = false
    fetchLive().then(
      (fresh) => {
        if (gone) return
        setData(fresh)
        setLive(true)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(fresh))
        } catch {
          // Private browsing: no cache, ask again next time.
        }
      },
      () => {},
    )
    return () => {
      gone = true
    }
  }, [])

  return { ...data, live }
}
