import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import logo from './assets/logo.svg'
import physicsShot from './assets/physics.webp'
import placeShot from './assets/place.webp'
import worldShot from './assets/world.webp'
import { toStops, useGitHub } from './github'
import { SceneCanvas } from './SceneCanvas'
import { CHAPTERS, SITE } from './site'
import { useChapterProgress } from './useChapterProgress'

const num = (i: number) => String(i).padStart(2, '0')

function Chapter(props: {
  index: number
  side: 'left' | 'right'
  title: ReactNode
  children: ReactNode
  shot?: { src: string; alt: string; caption: string }
}) {
  const { index, side, title, children, shot } = props
  return (
    <section className={`chapter chapter--${side}`} data-chapter id={CHAPTERS[index].toLowerCase().replace(' ', '-')}>
      <div className="panel reveal">
        <p className="eyebrow">
          <span>{num(index)}</span> {CHAPTERS[index]}
        </p>
        <h2>{title}</h2>
        {children}
        {shot && (
          <figure className="shot">
            <a href={shot.src} target="_blank" rel="noreferrer">
              <img src={shot.src} alt={shot.alt} width={1600} height={950} loading="lazy" />
            </a>
            <figcaption>{shot.caption}</figcaption>
          </figure>
        )}
      </div>
    </section>
  )
}

const Key = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>

export default function App() {
  const { progress, active } = useChapterProgress('[data-chapter]')
  const readout = useRef<HTMLParagraphElement>(null)
  const github = useGitHub()
  const { version, milestones } = github
  const stops = useMemo(() => toStops(milestones), [milestones])
  // The line in the scene starts at the release that is out.
  const stations = useMemo(
    () => [{ version, name: 'Released', done: 1, total: 1, origin: true }, ...stops],
    [version, stops],
  )

  // Panels fade in as they enter the viewport.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('is-in', e.isIntersecting)),
      { threshold: 0.18 },
    )
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const goTo = (i: number) => {
    const el = document.querySelectorAll<HTMLElement>('[data-chapter]')[i]
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const last = i === 0 || i === CHAPTERS.length - 1
    window.scrollTo({ top: last ? top : top + (el.offsetHeight - window.innerHeight) / 2 })
  }

  const { partner } = SITE

  return (
    <>
      <SceneCanvas progress={progress} readout={readout} stations={stations} />

      <header className="bar">
        <a className="brand" href="#forge" onClick={(e) => (e.preventDefault(), goTo(0))}>
          <img src={logo} alt="" width={28} height={28} />
          <span>RedForge</span>
        </a>
        <nav>
          <a href={SITE.repo}>GitHub</a>
          <a href={SITE.discord}>Discord</a>
          <a className="btn btn--small" href={SITE.latest}>
            Download
          </a>
        </nav>
      </header>

      <nav className="rail" aria-label="Chapters">
        {CHAPTERS.map((name, i) => (
          <button key={name} className={i === active ? 'is-active' : ''} onClick={() => goTo(i)} aria-current={i === active}>
            <span className="rail__name">{name}</span>
            <span className="rail__num">{num(i)}</span>
            <i />
          </button>
        ))}
      </nav>

      <p className="readout" ref={readout} aria-hidden="true" />

      <main>
        <section className="chapter chapter--hero" data-chapter id="forge">
          <div className="hero">
            <p className="eyebrow">
              Free · Open source · v{version}
            </p>
            <h1>
              Red<em>Forge</em>
            </h1>
            <p className="lede">
              A map editor for RedM. It streams Red Dead Redemption 2's world around you, lets you change it, and
              exports your work as a ready-to-stream resource.
            </p>
            <div className="actions">
              <a className="btn" href={SITE.latest}>
                Download {version}
              </a>
              <a className="btn btn--ghost" href={SITE.repo}>
                Source on GitHub
              </a>
            </div>
            <p className="platforms">Windows 10/11 · Linux · written in Rust</p>
          </div>
          <button className="cue" onClick={() => goTo(1)}>
            Scroll to forge a world <span aria-hidden="true">↓</span>
          </button>
        </section>

        <Chapter
          index={1}
          side="left"
          title={
            <>
              The world, as the game <em>draws it.</em>
            </>
          }
          shot={{ src: worldShot, alt: "RedForge's world map at Valentine", caption: 'The world map, at Valentine' }}
        >
          <p>
            The streamed map with its LODs, interiors, terrain, water, instanced trees and grass, lights, shadows, sky
            and weather. At any hour.
          </p>
        </Chapter>

        <Chapter
          index={2}
          side="right"
          title={
            <>
              Move anything. <em>Undo everything.</em>
            </>
          }
        >
          <p>
            Select, move, rotate, scale, duplicate, copy, delete, drop to the ground. Every field is editable in
            Properties, and LOD links are kept right.
          </p>
          <ul className="keys">
            <li>
              <Key>Q</Key> Move
            </li>
            <li>
              <Key>E</Key> Rotate
            </li>
            <li>
              <Key>T</Key> Scale
            </li>
            <li>
              <Key>End</Key> Drop to ground
            </li>
            <li>
              <Key>Ctrl</Key>
              <Key>Z</Key> Undo
            </li>
            <li>
              <Key>F1</Key> Every shortcut
            </li>
          </ul>
        </Chapter>

        <Chapter
          index={3}
          side="left"
          title={
            <>
              Every object of the game. <em>And of your mod.</em>
            </>
          }
          shot={{ src: placeShot, alt: 'Placing a barrel from the Objects pane', caption: 'Placing a barrel from the Objects pane' }}
        >
          <p>
            Search every archetype, with 3D thumbnails. Its model follows the mouse and shows where a click will put
            it. Building a fence? <Key>Ctrl</Key>
            <Key>Shift</Key>
            <Key>D</Key> copies the selection as far again as the last drag.
          </p>
        </Chapter>

        <Chapter
          index={4}
          side="right"
          title={
            <>
              See what the game <em>sees.</em>
            </>
          }
          shot={{
            src: physicsShot,
            alt: 'Physics mode: the collisions, coloured by material',
            caption: 'Physics mode: collisions, coloured by material',
          }}
        >
          <p>Ten selection modes show what a map is really made of, to see and inspect:</p>
          <ul className="tags">
            {[
              'Collisions',
              'Navmeshes',
              'Occluders',
              'Rooms and portals',
              'Time cycle modifiers',
              'Ambient mask volumes',
              'Scenario points',
              'Lights',
              'Skeletons',
            ].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Chapter>

        <Chapter
          index={5}
          side="left"
          title={
            <>
              From a project <em>to your server.</em>
            </>
          }
        >
          <dl className="steps">
            <div>
              <dt>Projects</dt>
              <dd>
                An <code>.rfproj</code> holds your ymaps, ytyps, models and textures. Drop files, or their Sollumz
                XML, on the window. Autosaved.
              </dd>
            </div>
            <div>
              <dt>Blender</dt>
              <dd>Send the selection to Blender, edit it, and see it back on the map right away.</dd>
            </div>
            <div>
              <dt>RedM resource</dt>
              <dd>
                One export gives a <code>stream</code> folder and an <code>fxmanifest.lua</code>. Add{' '}
                <code>ensure &lt;name&gt;</code> and it's live.
              </dd>
            </div>
            <div>
              <dt>Files</dt>
              <dd>
                Viewers for models, textures and animations; any game file to and from Sollumz XML; and{' '}
                <code>rf</code>, a command-line tool for the archives.
              </dd>
            </div>
          </dl>
        </Chapter>

        <Chapter
          index={6}
          side="left"
          title={
            <>
              The line <em>ahead.</em>
            </>
          }
        >
          <p>
            {version} is out. Every station down the track is a version, and the rails reach as far as the work has:
            this is read from GitHub, where the roadmap lives.
          </p>
          <ol className="stops">
            {stops.map((s) => (
              <li key={s.url}>
                <a href={s.url} title={s.description}>
                  <b>{s.version}</b>
                  <span>{s.name}</span>
                  <small>
                    {s.done}/{s.total}
                  </small>
                  <i style={{ transform: `scaleX(${s.total ? s.done / s.total : 0})` }} />
                </a>
              </li>
            ))}
          </ol>
          <p className="next">
            <a href={SITE.roadmap}>The whole roadmap on GitHub</a>
            {github.live ? '' : ' · as of the last build'}
          </p>
        </Chapter>

        <Chapter
          index={7}
          side="right"
          title={
            <>
              In partnership with <em>{partner.name}.</em>
            </>
          }
        >
          {partner.logo && <img className="partner__logo" src={partner.logo} alt="" width={64} height={64} loading="lazy" />}
          <p>{partner.blurb}</p>
          <ul className="partner__links">
            {partner.links.map((l) => (
              <li key={l.url}>
                <a className="btn btn--ghost btn--small" href={l.url}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </Chapter>

        <section className="chapter chapter--end" data-chapter id="get-it">
          <div className="end reveal">
            <p className="eyebrow">
              <span>{num(8)}</span> Get it
            </p>
            <h2>
              Start <em>forging.</em>
            </h2>
            <div className="actions">
              <a className="btn" href={SITE.latest}>
                Download {version}
              </a>
              <a className="btn btn--ghost" href={SITE.discord}>
                Join the Discord
              </a>
              <a className="btn btn--ghost" href={SITE.roadmap}>
                Roadmap
              </a>
            </div>
            <ul className="installs">
              <li>
                <b>Windows 10/11</b>
                <span>
                  <code>.msi</code> installer
                </span>
              </li>
              <li>
                <b>Debian, Ubuntu</b>
                <span>
                  <code>.deb</code> package
                </span>
              </li>
              <li>
                <b>Any Linux</b>
                <span>AppImage or Flatpak</span>
              </li>
              <li>
                <b>Arch Linux</b>
                <span>
                  PKGBUILD in <code>packaging/arch</code>
                </span>
              </li>
            </ul>
            <p className="note">
              You need Red Dead Redemption 2 installed (Steam, Rockstar Games Launcher or Epic). RedForge reads its
              files and never changes them. GPU: Vulkan on Linux, DirectX 12 or Vulkan on Windows.
            </p>

          </div>

          <footer className="foot">
            <p>
              RedForge is free software, MIT or Apache-2.0, by Simomagy (Prysma Studio). Its Blender add-on is a fork of
              Sollumz RDR. Tested by Fenixs. In partnership with{' '}
              <a href={partner.url}>{partner.name}</a>.
            </p>
            <p>
              Red Dead Redemption 2 is Rockstar Games'. RedForge is a fan-made tool, not affiliated with or endorsed
              by Rockstar Games or Take-Two Interactive.
            </p>
          </footer>
        </section>
      </main>
    </>
  )
}
