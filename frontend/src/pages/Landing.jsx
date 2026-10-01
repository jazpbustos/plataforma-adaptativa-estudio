import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import BrainStory from '../components/BrainStory.jsx'
import RutaDominio from '../components/RutaDominio.jsx'
import Statement from '../components/Statement.jsx'
import Reveal from '../components/Reveal.jsx'
import { Page, Margin, Note, Scribble, Sketch, PageTurn, CutFooter, TEAR } from '../components/Notebook.jsx'
import { Kicker, Floaty, BulbDoodle, BrainDoodle, SmileDoodle, FootDoodle, FlagDoodle } from '../components/Doodles.jsx'
import HeroBook from '../components/HeroBook.jsx'
import Logo from '../components/Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'


// Etiqueta de sección escrita a mano
function Eyebrow({ children }) {
  return <Kicker>{children}</Kicker>
}

export default function Landing() {
  const { user } = useAuth()
  // La portada es siempre clara (el cuaderno está pensado en papel claro). La preferencia guardada para la app no se toca: al salir se restaura.
  useEffect(() => {
    const root = document.documentElement, prev = root.dataset.theme
    root.dataset.theme = 'light'
    const mo = new MutationObserver(() => { if (root.dataset.theme !== 'light') root.dataset.theme = 'light' })
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { mo.disconnect(); if (prev) root.dataset.theme = prev }
  }, [])
  const startState = user ? undefined : { from: { pathname: '/empezar' } }
  return (
    <div className="notebook min-h-dvh overflow-x-clip">
      {/* Hojas 01 y 02: el hero gira una vuelta completa y se convierte en la frase (en pantallas chicas van apiladas) */}
      <PageTurn nA="01" nB="02" paperA="cream" paperB="lined"
        a={(
          <div className="flex h-full flex-col">
            {/* Header en forma de píldora. Queda arriba y no acompaña el scroll. */}
            <div className="nb-topsheet"><header className="relative mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-10">
                <Logo />
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <a href="#modulos" className="hidden rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-elev hover:text-fg md:block">Módulos</a>
                  <a href="#ruta" className="hidden rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-elev hover:text-fg md:block">Tu ruta</a>
                  <Link to={user ? '/app' : '/ingresar'} className="btn btn-primary btn-sm">{user ? 'Mi espacio' : 'Ingresar'}</Link>
                </div>
              </header>
            <svg className="nb-toptear" viewBox="0 0 1440 20" preserveAspectRatio="none" aria-hidden="true"><path d={TEAR} /></svg></div>

            {/* HERO: cuaderno abierto con el cerebro vivo */}
            <section className="nb-hsec relative z-[2] shrink-0 grow overflow-hidden">
              <HeroBook user={user} startState={startState} />
            </section>
          </div>
        )}
        b={(p) => (
          <div className="relative grid h-full place-items-center">
            <Statement progress={p} />
            <Margin>
              <Note show={p > .62} rotate={-6} size={1.4} style={{ left: 40, top: 70 }}>{'así estudiamos\nhoy...'}</Note>
              <Scribble show={p > .7} kind="downRight" style={{ left: 70, top: 128 }} scale={.8} />
              <Note show={p > .85} rotate={3} size={1.4} delay={200} style={{ right: 40, bottom: 60, textAlign: 'right' }}>{'...y así\npodría ser.'}</Note>
              <Scribble show={p > .93} kind="upLeft" delay={200} style={{ right: 150, bottom: 96 }} scale={.8} />
            </Margin>
          </div>
        )} />

      {/* 01 · LOS MÓDULOS — el cerebro 3D se enciende módulo a módulo con el scroll */}
      {/* Hoja 03 · cuadriculada: el cerebro 3D con scroll fijo */}
      <Page n="03" paper="grid" turn={false}>
      <section id="modulos" className="nb-clear border-y border-line/70 bg-panel">
        <BrainStory decor={(
          <div aria-hidden="true" className="nb-deco pointer-events-none absolute inset-0">
            <Sketch kind="orbit" size={560} className="left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 wide:left-[70%] wide:top-1/2" />
          </div>
        )} />
      </section>
      </Page>

      {/* 02 · TU RUTA — los pasos concretos hasta el 100 % de dominio */}
      {/* Hoja 04 · lila: la ruta paso a paso */}
      <Page n="04" paper="grid" turn={false}>
      <section id="ruta" className="relative">
        <RutaDominio />
      </section>
      </Page>

      {/* Hoja 05 · cierre y pie */}
      <Page n="05" paper="dots">
      {/* 03 · EMPEZÁ — cierre centrado con brillo violeta */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(40%_60%_at_50%_60%,color-mix(in_srgb,var(--violet)_16%,transparent),transparent_70%)]" />
        <Reveal className="relative mx-auto grid max-w-[760px] justify-items-center gap-6 px-4 py-28 text-center sm:px-10">
          <Eyebrow>Empezá hoy</Eyebrow>
          <h2 className="display text-[clamp(2.1rem,4.4vw,3.4rem)]">Tu ruta de estudio, <span className="accent">a tu medida.</span></h2>
          <p className="max-w-[46ch] text-muted">Cargá tu material, elegí un tema y empezá a recorrer tu ruta paso a paso.</p>
          <Link to={user ? '/empezar' : '/ingresar'} state={startState} className="btn btn-primary">Empezar con mis apuntes <span className="arrow">→</span></Link>
        </Reveal>
        <Floaty rot={-5} delay={.2} label="más ideas" style={{ left: '12%', top: '26%' }}><BulbDoodle /></Floaty>
        <Floaty rot={4} delay={1.4} label="más conexiones" style={{ right: '11%', top: '20%' }}><BrainDoodle /></Floaty>
        <Floaty rot={-3} delay={2.2} label="más vos" style={{ right: '19%', bottom: '14%' }}><SmileDoodle /></Floaty>
      </section>

      <CutFooter>
        <footer className="relative mx-auto grid max-w-[1180px] gap-1 px-4 pt-12 pb-9 text-center text-xs text-muted sm:px-10">
          <span>Plataforma adaptativa de estudio con Inteligencia Artificial</span>
          <span>© {new Date().getFullYear()} · Desarrollado por Jazmín Bustos</span>
        </footer>
      </CutFooter>
      </Page>
    </div>
  )
}
