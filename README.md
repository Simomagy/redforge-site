# redforge-site

The front page of [RedForge](https://github.com/Simomagy/RedForge): one
three.js scene that the scroll flies through, from the anvil to the world it
forges and back. Vite, React, TypeScript.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks, then writes dist/
npm run preview  # serves dist/
```

## What comes from GitHub

The version on the download buttons and the roadmap (the list, and the railway
in the scene: one station per open milestone, rails laid as far as its issues
are closed) are read from the public GitHub API of `Simomagy/RedForge` in the
visitor's browser, and kept for 20 minutes. Releasing a version or closing an
issue updates the site by itself: nothing to rebuild.

`npm run build` also saves what GitHub says at that moment in
`src/github.snapshot.json` (`npm run sync` does only that). The page starts
from it, and stays on it for visitors GitHub doesn't answer (it allows 60
anonymous requests an hour per address).

Milestones are expected to be titled like `2.7 — Navmesh: polygons and
attributes`: the part before the dash is the station's name.

## What to edit

- `src/site.ts`: every link, and the partner studio (name, link,
  logo, one line, and the words on the sign of its house in the scene).
  A logo goes in `public/` and is named by its path, like `/partner.svg`.
- `src/App.tsx`: the page's text, one `<Chapter>` per stop of the flight.
- `src/scene/world.ts`: the camera keys (one per chapter), the sky of each
  chapter (`MOODS`) and what happens when (`frame`).
- `src/scene/terrain.ts`, `forge.ts`, `props.ts`, `partner.ts`, `roadmap.ts`, `sky.ts`: the ground and its
  shader, the anvil and sparks, the town, fence and gizmo, the partner's house, the roadmap's railway, the sky and stars.

The number of `data-chapter` sections in `App.tsx`, the camera keys and
`MOODS` in `world.ts` and `CHAPTERS` in `site.ts` go together: nine of each (`SHIFT_X` and
`PARTNER_AT` in `world.ts` follow them too).

## Hosting

The build expects to be served from the root of its domain (Vite's `base` is
`/`). `og:image` in `index.html` should become an absolute URL once the domain
is known: link previews need one.

## Behaviour

- Phones and touch devices get a lighter scene: fewer triangles, trees and
  sparks, no bloom. The pixel ratio drops by itself if frames get slow.
- With `prefers-reduced-motion` nothing moves on its own: the hammer and its
  sparks are still, and the scene is redrawn only when the page scrolls.
  `?reduce` on the dev server shows that mode.
- In dev, `__world.jump()` skips the camera's easing and `__world.bench()`
  returns the milliseconds one frame takes.

RedForge is a fan-made tool, not affiliated with or endorsed by Rockstar Games
or Take-Two Interactive.
