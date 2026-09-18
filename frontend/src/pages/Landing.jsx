import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrainStory from '../components/BrainStory.jsx'
import RutaDominio from '../components/RutaDominio.jsx'
import Statement from '../components/Statement.jsx'
import Reveal from '../components/Reveal.jsx'
import Logo from '../components/Logo.jsx'
import NeuralBrain, { PHASES } from '../components/NeuralBrain.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../context/AuthContext.jsx'


// Etiqueta de sección numerada: 01 —— El recorrido
function Eyebrow({ n, children }) {
  return <span className="label flex items-center gap-3">{n ? <span className="accent">{n}</span> : <i className="size-1.5 rounded-full bg-violet" />}<i className="h-px w-8 bg-rule" />{children}</span>
}

export default function Landing() {
  const { user } = useAuth()
  const [phase, setPhase] = useState(PHASES.sources)
  const startState = user ? undefined : { from: { pathname: '/empezar' } }

  return (
    <div className="min-h-dvh">
      {/* Header en forma de píldora. Queda arriba y no acompaña el scroll. */}
      <header className="relative z-30 px-3 pt-3 sm:pt-4">
        <nav className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 rounded-full border border-line/60 bg-[color-mix(in_srgb,var(--bg-card)_80%,transparent)] py-1.5 pr-1.5 pl-4 sm:py-2 sm:pr-2 sm:pl-5 shadow-[0_8px_30px_-16px_rgba(0,0,0,.35)] backdrop-blur-xl">
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

      {/* HERO */}
      <section className="relative overflow-hidden bg-[radial-gradient(55%_65%_at_78%_45%,color-mix(in_srgb,var(--violet)_10%,transparent),transparent_70%)]">
        <div className="mx-auto grid max-w-[1180px] items-center gap-6 px-4 pt-14 pb-12 sm:px-10 lg:min-h-[620px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:pt-4">
          <div className="rise relative z-10 grid gap-7">
            <Eyebrow>Una nueva forma de estudiar</Eyebrow>
            <h1 className="display text-[clamp(2.2rem,3.4vw,3.3rem)]">
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
          <div className="relative -mx-4 h-[340px] sm:h-[420px] lg:mx-0 lg:h-[560px]">
            <NeuralBrain morph onPhase={setPhase} />
            <span className="label pointer-events-none absolute right-2 bottom-0">{phase}</span>
          </div>
        </div>
      </section>

      {/* Transición: frase que se enciende al scrollear */}
      <Statement />

      {/* 01 · LOS MÓDULOS — el cerebro 3D se enciende módulo a módulo con el scroll */}
      <section id="modulos" className="border-y border-line/70 bg-panel">
        <BrainStory />
      </section>

      {/* 02 · TU RUTA — los pasos concretos hasta el 100 % de dominio */}
      <section id="ruta" className="mx-auto max-w-[1180px] px-4 py-24 sm:px-10">
        <RutaDominio header={(
          <Reveal className="grid justify-items-start gap-4">
            <Eyebrow n="02">Tu ruta</Eyebrow>
            <h2 className="display text-[clamp(1.9rem,3.4vw,2.7rem)]">Paso a paso, <br className="hidden lg:block" /><span className="accent">hasta dominar el&nbsp;tema.</span></h2>
            <p className="balance max-w-[40ch] text-muted">Cada tema se recorre en el mismo orden. Cada paso completado suma a tu nivel de dominio.</p>
          </Reveal>
        )} />
      </section>

      {/* 03 · EMPEZÁ — cierre centrado con brillo violeta */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(40%_60%_at_50%_60%,color-mix(in_srgb,var(--violet)_16%,transparent),transparent_70%)]" />
        <Reveal className="relative mx-auto grid max-w-[760px] justify-items-center gap-6 px-4 py-28 text-center sm:px-10">
          <Eyebrow n="03">Empezá hoy</Eyebrow>
          <h2 className="display text-[clamp(2.1rem,4.4vw,3.4rem)]">Tu ruta de estudio, <span className="accent">a tu medida.</span></h2>
          <p className="max-w-[46ch] text-muted">Definí tu objetivo y sumá tus apuntes si los tenés. Con eso se arma tu ruta.</p>
          <Link to={user ? '/empezar' : '/ingresar'} state={startState} className="btn btn-primary">Empezar con mis apuntes <span className="arrow">→</span></Link>
        </Reveal>
      </section>

      <footer className="mx-auto grid max-w-[1180px] gap-1 border-t border-line/70 px-4 py-8 text-center text-xs text-muted sm:px-10">
        <span>Plataforma adaptativa de estudio con Inteligencia Artificial</span>
        <span>© {new Date().getFullYear()} · Desarrollado por Jazmín Bustos</span>
      </footer>
    </div>
  )
}
