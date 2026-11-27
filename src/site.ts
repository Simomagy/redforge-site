/**
 * Links and the partner studio. The version and the roadmap are not here:
 * they come from GitHub (see github.ts).
 */
export const SITE = {
  releases: 'https://github.com/Simomagy/RedForge/releases',
  latest: 'https://github.com/Simomagy/RedForge/releases/latest',
  repo: 'https://github.com/Simomagy/RedForge',
  roadmap: 'https://github.com/users/Simomagy/projects/3',
  discord: 'https://discord.gg/UXAavjMFZV',
  /**
   * The partner studio: its chapter of the page, and the sign of its house
   * in the scene. `logo` is a path under `public/` (for example
   * '/partner.svg'), or empty; `links` are shown under the blurb.
   */
  partner: {
    name: 'Snail Interactive',
    url: 'https://snailinteractive.net/',
    logo: '',
    /** The small line under the name on the sign of their house in the scene. */
    tagline: 'MLOs for RedM',
    blurb:
      'High-quality, immersive MLOs for RedM: interiors that fit the historical setting of the game, built for authenticity, detail and atmosphere.',
    links: [
      { label: 'Website', url: 'https://snailinteractive.net/' },
      { label: 'Discord', url: 'https://discord.gg/9k6DD6MjaS' },
      { label: 'KAJOJ store', url: 'https://kajoj.tebex.io/' },
      { label: 'NELLO store', url: 'https://nello.tebex.io/' },
    ],
  },
}

export const CHAPTERS = ['Forge', 'World', 'Edit', 'Place', 'Inspect', 'Ship', 'Roadmap', 'Partner', 'Get it'] as const
