// Writes src/github.snapshot.json: the latest release and the open milestones
// of the repository, as the page shows them when GitHub can't be reached from
// the visitor's browser. Runs before every build; keeps the old snapshot if
// GitHub doesn't answer.
import { writeFile } from 'node:fs/promises'

const REPO = 'Simomagy/RedForge'
const OUT = new URL('../src/github.snapshot.json', import.meta.url)

async function get(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

try {
  const [release, milestones] = await Promise.all([
    get('releases/latest'),
    get('milestones?state=open&per_page=100'),
  ])
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    version: release.tag_name.replace(/^v/, ''),
    milestones: milestones.map((m) => ({
      title: m.title,
      description: m.description ?? '',
      open: m.open_issues,
      closed: m.closed_issues,
      url: m.html_url,
    })),
  }
  await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`github snapshot: ${snapshot.version}, ${snapshot.milestones.length} milestones`)
} catch (e) {
  console.warn(`github snapshot not refreshed (${e.message}); keeping the one in the repository`)
}
