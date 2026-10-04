import { useEffect, useRef, useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import PaperTopbar from '../components/PaperTopbar.jsx'
import usePaperTheme from '../lib/usePaperTheme.js'
import { Floaty, DocDoodle, CodeDoodle, MedalDoodle, QuizDoodle } from '../components/Doodles.jsx'
import Synapse from '../components/Synapse.jsx'

export default function Login() {
  const { user, config, loading, loginGoogle, loginDev } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const from = useLocation().state?.from?.pathname || '/app'

  usePaperTheme() // igual que la portada: siempre papel claro

  if (!loading && user) return <Navigate to={from} replace />

  const run = async (fn) => {
    setError(''); setBusy(true)
    try { await fn(); navigate(from, { replace: true }) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="notebook min-h-dvh overflow-x-clip">
      <div className="nb-page nb-lined relative flex min-h-dvh flex-col">
        <PaperTopbar right={<Link to="/" className="text-sm text-muted hover:text-fg">Volver al inicio ↗</Link>} />

      <main className="relative z-[2] mx-auto grid w-full flex-1 place-items-center px-5 py-12">
        <Floaties />
        <section className="rise grid w-full max-w-[36rem] justify-items-center gap-7 text-center">
          <div className="grid justify-items-center gap-3">
            <BookMark />
            <h1 className="display text-[clamp(2rem,4vw,3.2rem)]" style={{ lineHeight: 1.08 }}>Entrá y retomá<br /><span className="accent">donde te quedaste.</span></h1>
            <p className="text-muted">Tus apuntes, ejercicios y avances quedan juntos en un mismo lugar.</p>
          </div>

          <div className="lg-card">
            <div className="lg-gtitle"><GMark /><span>Ingresá con tu cuenta de Google</span></div>
            {loading ? <Synapse>Preparando</Synapse>
              : config?.offline ? <p className="text-sm text-red">No se pudo conectar con el servidor. Levantá el backend en el puerto 8000.</p>
              : (
                <>
                  {config?.google_client_id ? (
                    <GoogleOAuthProvider clientId={config.google_client_id} locale="es">
                      <div className={busy ? 'pointer-events-none opacity-50' : ''}>
                        <GoogleLogin onSuccess={({ credential }) => run(() => loginGoogle(credential))}
                          onError={() => setError('No se pudo iniciar sesión con Google.')}
                          text="continue_with" shape="pill" size="large" width="300" locale="es" theme="outline" />
                      </div>
                    </GoogleOAuthProvider>
                  ) : (
                    <p className="font-mono text-xs text-orange">Falta GOOGLE_CLIENT_ID en backend/.env</p>
                  )}
                  {config?.dev_login && (
                    <>
                      <div className="flex w-full items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o en desarrollo<span className="h-px flex-1 bg-line" /></div>
                      <button type="button" className="btn btn-soft w-full" disabled={busy} onClick={() => run(loginDev)}>Entrar en modo demo</button>
                    </>
                  )}
                </>
              )}
            {busy && <Synapse>Conectando tu cuenta</Synapse>}
            {error && <p role="alert" className="text-sm text-red">{error}</p>}
          </div>
          <p className="max-w-[24rem] text-xs text-muted">Solo usamos tu nombre, correo y foto de perfil de Google para identificarte. Si es tu primera vez, la cuenta se crea sola.</p>
        </section>
      </main>
      </div>
    </div>
  )
}

/* dibujo central: libro abierto con un marcapáginas que asoma (solo decorativo) */
function BookMark() {
  const ink = 'var(--ink-hand, #3a2a7a)'
  return (
    <div aria-hidden="true" className="lg-book lg-book-still nb-float" style={{ '--r': '-2deg' }}>
      <svg viewBox="0 0 160 126" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 34v62c26-5 52-4 74 6 22-10 48-11 74-6V34" strokeWidth="2.6" />
        <path d="M80 32C60 20 32 20 12 27v62c24-5 50-4 68 5z" fill="var(--doodle-fill)" />
        <path d="M80 32c20-12 48-12 68-5v62c-24-5-50-4-68 5z" fill="var(--doodle-fill)" />
        <path d="M80 32v62" strokeWidth="2.4" />
        <path d="M24 46c12-3 26-2 42 3M24 58c12-3 26-2 42 3M24 70c10-2 20-2 30 1" strokeWidth="2.2" />
        <path d="M94 49c16-5 30-6 42-3M94 61c16-5 30-6 42-3M94 73c10-3 20-3 30-1" strokeWidth="2.2" />
        <g className="lg-ribbon">
          <path d="M73 58h14l1 62-8-8-8 8z" fill="#a58bff" />
          <path d="M80 64v40" strokeWidth="1.8" opacity=".5" />
        </g>
      </svg>
    </div>
  )
}

function GMark() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

/* iconos a mano flotando alrededor de la tarjeta; se corren apenas hacia el cursor (cada uno a su profundidad) */
const ITEMS = [
  { D: DocDoodle, label: 'tus apuntes', pos: { left: 'calc(200px + 2%)', top: '22%' }, rot: -6, delay: 0, k: 26 },
  { D: MedalDoodle, label: 'tu meta', pos: { left: 'calc(210px + 4%)', top: '66%' }, rot: 5, delay: 1.2, k: 16 },
  { D: CodeDoodle, label: 'ejercicios', pos: { right: '11%', top: '28%' }, rot: 6, delay: .6, k: 30 },
  { D: QuizDoodle, label: 'te evaluamos', pos: { right: 'calc(3% + 60px)', top: '62%' }, rot: -5, delay: 1.8, k: 18 },
]
function Floaties() {
  const ref = useRef(null)
  useEffect(() => {
    const root = ref.current
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = [...root.querySelectorAll('[data-k]')], cur = els.map(() => [0, 0])
    let tx = 0, ty = 0, raf = 0
    const move = (e) => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5 }
    const loop = () => {
      els.forEach((el, i) => {
        const k = +el.dataset.k, c = cur[i]
        c[0] += (tx * k - c[0]) * .06; c[1] += (ty * k - c[1]) * .06
        el.style.transform = `translate(${c[0].toFixed(2)}px, ${c[1].toFixed(2)}px)`
      })
      raf = requestAnimationFrame(loop)
    }
    addEventListener('pointermove', move); raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move) }
  }, [])
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
      {ITEMS.map(({ D, label, pos, rot, delay, k }) => (
        <div key={label} data-k={k} className="absolute" style={pos}>
          <Floaty rot={rot} delay={delay} label={label} style={{ position: 'relative' }}><D /></Floaty>
        </div>
      ))}
    </div>
  )
}
