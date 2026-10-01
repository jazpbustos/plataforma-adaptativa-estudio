import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import RutaDominio from '../components/RutaDominio.jsx'
import Statement from '../components/Statement.jsx'
import Reveal from '../components/Reveal.jsx'
import Logo from '../components/Logo.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import ParticleWorld from '../components/ParticleWorld.jsx'
import { CHAPTERS } from '../components/BrainStory.jsx'
import { useAuth } from '../context/AuthContext.jsx'

/*
  Landing en modo oscuro: un único lienzo de partículas fijo (ParticleWorld) que cambia de forma
  con el scroll, y por encima el texto de cada escena. Los ids (w-hero, w-statement, modulos,
  ruta, w-cierre) son las "paradas" que lee el lienzo: no cambiarlos sin tocar STOPS.
*/
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))

function Eyebrow({ n, children }) {
  return <span className="label flex items-center gap-3">{n ? <span className="accent">{n}</span> : <i className="size-1.5 rounded-full bg-violet" />}<i className="h-px w-8 bg-rule" />{children}</span>
}

// Los módulos: texto con scroll fijo. El lienzo de atrás enciende una región del cerebro por capítulo.
function ModulesText({ mastery = 68 }) {
  const storyRef = useRef(null), pctRef = useRef(null)
  const [ch, setCh] = useState(0)

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, cur = -1, shown = 0
    const update = () => {
      raf = 0
      const r = storyRef.current.getBoundingClientRect(), total = storyRef.current.offsetHeight - innerHeight
      const p = clamp(-r.top / Math.max(1, total)), c = Math.min(4, Math.floor(p * 5)), local = clamp(p * 5 - c)
      if (c !== cur) { cur = c; setCh(c) }
      const goal = c === 4 ? mastery * clamp(local * 2.2) : 0
      shown = reduce ? goal : shown + (goal - shown) * (c === 4 ? .35 : .8)
      if (pctRef.current) pctRef.current.textContent = `${Math.round(shown)}%`
      if (!reduce && Math.abs(goal - shown) > .4) raf = requestAnimationFrame(update)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [mastery])

  return (
    <section id="modulos" ref={storyRef} className="relative h-[520vh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* zona para arrastrar y girar el cerebro (el lienzo de atrás lo lee) */}
        <div data-world-drag className="absolute inset-y-0 right-0 hidden w-[58%] cursor-grab touch-pan-y active:cursor-grabbing wide:block" />
        <div className="pointer-events-none relative mx-auto grid h-full w-full max-w-[1180px] content-end px-4 pb-10 sm:px-10 wide:content-center wide:pb-0">
          <div className="grid max-w-[480px] gap-8">
            <div className="relative min-h-[250px] wide:min-h-[300px]">
              {CHAPTERS.map((c, i) => (
                <div key={c.n + c.kicker} aria-hidden={i !== ch}
                  className={`world-text absolute inset-x-0 bottom-0 grid content-end gap-4 transition-all duration-500 wide:top-0 wide:bottom-auto wide:content-start ${i === ch ? 'translate-y-0 opacity-100' : i < ch ? '-translate-y-4 opacity-0' : 'translate-y-4 opacity-0'}`}>
                  <span className="label flex items-center gap-3">{c.n ? <span style={{ color: c.color }}>{c.n}</span> : <i className="size-1.5 rounded-full" style={{ background: c.color }} />}<i className="h-px w-8 bg-rule" />{c.kicker}</span>
                  <h2 className={`display ${c.intro ? 'text-[clamp(2rem,3.8vw,3.1rem)]' : 'text-[clamp(2.4rem,4.8vw,4rem)]'}`}>
                    {c.title}{c.intro ? <br /> : ' '}
                    {c.pct ? <><span ref={pctRef} style={{ color: c.color }}>0%</span> conectada.</> : <span style={{ color: c.color }}>{c.accent}</span>}
                  </h2>
                  <p className="max-w-[40ch] text-muted">{c.desc}</p>
                </div>
              ))}
            </div>
            <ol className="flex flex-wrap gap-2" aria-label="Progreso de la sección">
              {CHAPTERS.slice(1).map((c, j) => {
                const i = j + 1, on = i === ch, done = i < ch
                return (
                  <li key={c.kicker} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-all duration-300"
                    style={{ borderColor: on ? c.color : 'var(--border)', color: on || done ? c.color : 'var(--text-secondary)',
                      background: on ? `color-mix(in srgb, ${c.color} 16%, transparent)` : 'color-mix(in srgb, var(--bg) 40%, transparent)' }}>
                    <i className="size-1.5 rounded-full transition-colors" style={{ background: on || done ? c.color : 'var(--rule)' }} />{c.kicker}
                  </li>
                )
              })}
            </ol>
            <p className="label hidden items-center gap-2 wide:flex" style={{ opacity: ch >= 1 ? .7 : 0, transition: 'opacity .5s' }}>
              <span aria-hidden="true">↔</span> arrastrá el cerebro para girarlo
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function LandingDark() {
  const { user } = useAuth()
  const startState = user ? undefined : { from: { pathname: '/empezar' } }

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <ParticleWorld />

      <div className="relative z-10">
        <header className="relative z-30 px-3 pt-3 sm:pt-4">
          <nav className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 rounded-full border border-line/60 bg-[color-mix(in_srgb,var(--bg-card)_70%,transparent)] py-1.5 pr-1.5 pl-4 sm:py-2 sm:pr-2 sm:pl-5 shadow-[0_8px_30px_-16px_rgba(0,0,0,.6)] backdrop-blur-xl">
            <Logo />
            <div className="hidden items-center gap-1 md:flex">
              <a href="#modulos" className="rounded-full px-4 py-1.5 text-sm text-muted transition hover:bg-elev hover:text-fg">Módulos</a>
              <a href="#ruta" className="rounded-full px-4 py-1.5 text-sm text-muted transition hover:bg-elev hover:text-fg">Tu ruta</a>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
              <ThemeToggle />
              <Link to={user ? '/app' : '/ingresar'} className="btn btn-primary btn-sm">{user ? 'Mi espacio' : 'Ingresar'}</Link>
            </div>
          </nav>
        </header>

        {/* HERO: apunte + código + chat hechos de partículas */}
        <section id="w-hero" className="relative -mt-[68px] grid min-h-dvh items-start pt-[68px] wide:items-center">
          <div className="mx-auto w-full max-w-[1180px] px-4 pt-16 pb-28 sm:px-10 wide:pt-0 wide:pb-0">
            <div className="rise world-text relative grid max-w-[600px] gap-7">
              <Eyebrow>Una nueva forma de estudiar</Eyebrow>
              <h1 className="display text-[clamp(2.3rem,4.4vw,4.1rem)]">
                Tus apuntes ya tienen ideas.<br /><span className="accent">Ahora conectalas.</span>
              </h1>
              <p className="balance max-w-[40ch] text-[1.05rem] text-muted">Aprendé, practicá y explicá cada tema a partir de tu propio material.</p>
              <div className="flex flex-wrap items-center gap-3">
                <Link to={user ? '/empezar' : '/ingresar'} state={startState} className="btn btn-primary">
                  Empezar con mis apuntes <span className="arrow">→</span>
                </Link>
                <a href="#modulos" className="btn btn-soft">Descubrí los módulos</a>
              </div>
            </div>
          </div>
          <a href="#w-statement" aria-label="Bajar" className="wcue label absolute bottom-7 left-1/2 hidden -translate-x-1/2 wide:flex flex-col items-center gap-2 text-muted">
            bajá
            <i className="wcue-line block h-9 w-px bg-rule" />
          </a>
        </section>

        {/* Las herramientas sueltas: la frase se enciende palabra a palabra */}
        <div id="w-statement" className="world-text"><Statement /></div>

        <ModulesText />

        {/* Tu ruta: el camino de partículas se va encendiendo a la derecha */}
        <section id="ruta" className="relative mx-auto max-w-[1180px] px-4 py-24 sm:px-10">
          <RutaDominio header={(
            <Reveal className="world-text grid justify-items-start gap-4">
              <Eyebrow n="02">Tu ruta</Eyebrow>
              <h2 className="display text-[clamp(1.9rem,3.4vw,2.7rem)]">Paso a paso, <br className="hidden lg:block" /><span className="accent">hasta dominar el&nbsp;tema.</span></h2>
              <p className="balance max-w-[40ch] text-muted">Cada tema se recorre en el mismo orden. Cada paso completado suma a tu nivel de dominio.</p>
            </Reveal>
          )} />
        </section>

        {/* Cierre: el cerebro completo arriba, la invitación abajo */}
        <section id="w-cierre" className="relative grid min-h-dvh items-end">
          <Reveal className="world-text relative mx-auto grid max-w-[760px] justify-items-center gap-6 px-4 pt-[60dvh] pb-16 text-center sm:px-10">
            <Eyebrow n="03">Empezá hoy</Eyebrow>
            <h2 className="display text-[clamp(2.1rem,4.4vw,3.4rem)]">Tu ruta de estudio, <span className="accent">a tu medida.</span></h2>
            <p className="max-w-[46ch] text-muted">Definí tu objetivo y sumá tus apuntes si los tenés. Con eso se arma tu ruta.</p>
            <Link to={user ? '/empezar' : '/ingresar'} state={startState} className="btn btn-primary">Empezar con mis apuntes <span className="arrow">→</span></Link>
          </Reveal>
        </section>

        <footer className="relative mx-auto grid max-w-[1180px] gap-1 border-t border-line/70 px-4 py-8 text-center text-xs text-muted sm:px-10">
          <span>Plataforma adaptativa de estudio con Inteligencia Artificial</span>
          <span>© {new Date().getFullYear()} · Desarrollado por Jazmín Bustos</span>
        </footer>
      </div>
    </div>
  )
}
