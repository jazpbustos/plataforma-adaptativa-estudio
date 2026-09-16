import { useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from '../components/Logo.jsx'
import NeuralBrain from '../components/NeuralBrain.jsx'
import Synapse from '../components/Synapse.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import useIsDark from '../lib/useIsDark.js'

const modules = [
  ['Aprender', 'var(--blue)'],
  ['Practicar', 'var(--green)'],
  ['Consolidar', 'var(--pink)'],
]

export default function Login() {
  const { user, config, loading, loginGoogle, loginDev } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const from = useLocation().state?.from?.pathname || '/'
  const isDark = useIsDark()

  if (!loading && user) return <Navigate to={from} replace />

  const run = async (fn) => {
    setError(''); setBusy(true)
    try { await fn(); navigate(from, { replace: true }) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="relative grid min-h-dvh grid-rows-[auto_1fr] overflow-hidden bg-[radial-gradient(60%_70%_at_75%_50%,color-mix(in_srgb,var(--violet)_9%,transparent),transparent_70%)]">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 py-4 sm:px-[4vw] xl:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-[1120px] items-center gap-8 px-4 pb-10 sm:px-[4vw] md:grid-cols-2 xl:px-6">
        <section className="rise relative z-10 grid max-w-xl gap-6">
          <span className="label">Plataforma adaptativa de estudio</span>
          <h1 className="text-[clamp(2.3rem,4.6vw,3.6rem)] leading-[1.02] font-light tracking-[-.04em]">
            Del apunte <strong className="gradient-text font-semibold">disperso</strong> al conocimiento conectado.
          </h1>
          <p className="max-w-[44ch] text-muted">
            Subís tu material, te armamos una ruta según tus días y tu nivel, y la plataforma te acompaña mientras aprendés, practicás y consolidás.
          </p>

          <div className="grid gap-3 border-t border-line pt-6">
            {loading ? (
              <Synapse>Preparando</Synapse>
            ) : config?.offline ? (
              <p className="text-sm text-red">No se pudo conectar con el servidor. Levantá el backend en el puerto 8000.</p>
            ) : (
              <>
                {config?.google_client_id ? (
                  <GoogleOAuthProvider clientId={config.google_client_id} locale="es">
                    <div className={busy ? 'pointer-events-none opacity-50' : ''}>
                      <GoogleLogin
                        onSuccess={({ credential }) => run(() => loginGoogle(credential))}
                        onError={() => setError('No se pudo iniciar sesión con Google.')}
                        text="continue_with" shape="rectangular" size="large" width="320" locale="es"
                        theme={isDark ? 'filled_black' : 'outline'}
                      />
                    </div>
                  </GoogleOAuthProvider>
                ) : (
                  <p className="font-mono text-xs text-orange">Falta GOOGLE_CLIENT_ID en backend/.env</p>
                )}
                {config?.dev_login && (
                  <button type="button" className="btn btn-secondary w-[320px] max-w-full" disabled={busy} onClick={() => run(loginDev)}>
                    Entrar en modo demo
                  </button>
                )}
              </>
            )}
            {busy && <Synapse>Conectando tu cuenta</Synapse>}
            {error && <p role="alert" className="text-sm text-red">{error}</p>}
            <p className="text-xs text-muted">Solo usamos tu nombre, correo y foto de perfil de Google para identificarte.</p>
          </div>
        </section>

        <div className="relative -mx-4 h-[340px] md:mx-0 md:h-[560px]">
          <NeuralBrain />
          <div className="pointer-events-none absolute right-2 bottom-0 flex flex-wrap justify-end gap-4">
            {modules.map(([name, c]) => (
              <span key={name} className="label flex items-center gap-2">
                <i className="size-2 rounded-full" style={{ background: c }} />{name}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
