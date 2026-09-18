import { useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from '../components/Logo.jsx'
import NeuralBrain from '../components/NeuralBrain.jsx'
import Synapse from '../components/Synapse.jsx'
import useIsDark from '../lib/useIsDark.js'

export default function Login() {
  const { user, config, loading, loginGoogle, loginDev } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const from = useLocation().state?.from?.pathname || '/app'
  const isDark = useIsDark()

  if (!loading && user) return <Navigate to={from} replace />

  const run = async (fn) => {
    setError(''); setBusy(true)
    try { await fn(); navigate(from, { replace: true }) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr]">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-5 sm:px-10">
        <Logo />
        <Link to="/" className="text-sm text-muted hover:text-fg">Volver al inicio ↗</Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-4 pb-12 sm:px-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rise grid max-w-md gap-7">
          <div className="grid gap-3">
            <span className="label">Tu espacio de estudio</span>
            <h1 className="display text-[clamp(2rem,4vw,2.9rem)]">Entrá y retomá<br /><span className="accent">donde te quedaste.</span></h1>
            <p className="text-muted">Tu material, tu ruta y tus avances quedan juntos en un mismo lugar.</p>
          </div>

          <div className="grid gap-3">
            {loading ? <Synapse>Preparando</Synapse>
              : config?.offline ? <p className="text-sm text-red">No se pudo conectar con el servidor. Levantá el backend en el puerto 8000.</p>
              : (
                <>
                  {config?.google_client_id ? (
                    <GoogleOAuthProvider clientId={config.google_client_id} locale="es">
                      <div className={busy ? 'pointer-events-none opacity-50' : ''}>
                        <GoogleLogin onSuccess={({ credential }) => run(() => loginGoogle(credential))}
                          onError={() => setError('No se pudo iniciar sesión con Google.')}
                          text="continue_with" shape="rectangular" size="large" width="360" locale="es"
                          theme={isDark ? 'filled_black' : 'outline'} />
                      </div>
                    </GoogleOAuthProvider>
                  ) : (
                    <p className="font-mono text-xs text-orange">Falta GOOGLE_CLIENT_ID en backend/.env</p>
                  )}
                  {config?.dev_login && (
                    <>
                      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o en desarrollo<span className="h-px flex-1 bg-line" /></div>
                      <button type="button" className="btn btn-soft w-full max-w-[360px]" disabled={busy} onClick={() => run(loginDev)}>Entrar en modo demo</button>
                    </>
                  )}
                </>
              )}
            {busy && <Synapse>Conectando tu cuenta</Synapse>}
            {error && <p role="alert" className="text-sm text-red">{error}</p>}
          </div>
          <p className="text-xs text-muted">Solo usamos tu nombre, correo y foto de perfil de Google para identificarte. Si es tu primera vez, la cuenta se crea sola.</p>
        </section>

        <div className="card relative hidden h-[520px] overflow-hidden md:block">
          <div className="absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_45%,color-mix(in_srgb,var(--violet)_12%,transparent),transparent_75%)]" />
          <div className="absolute inset-x-8 top-10 bottom-16"><NeuralBrain intensity={0.9} /></div>
          <span className="label absolute inset-x-0 bottom-8 text-center">del material al dominio</span>
        </div>
      </main>
    </div>
  )
}
