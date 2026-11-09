import { Link } from 'react-router-dom'
import PaperTopbar from '../components/PaperTopbar.jsx'

/*
  Política de privacidad. Google la pide (enlace en la pantalla de consentimiento) para publicar el ingreso con
  Google; describe los datos que se guardan, según el modelo de datos y la sección de Seguridad del trabajo.
*/
const SECCIONES = [
  ['Qué es', 'Esta plataforma es el prototipo del Trabajo Final de Graduación de la Licenciatura en Informática (Universidad Siglo 21). Se usa con fines académicos, para demostrar y evaluar su funcionamiento.'],
  ['Qué datos se guardan', 'Al ingresar con Google se guardan tu nombre, tu correo y tu foto de perfil; al ingresar con la clave de acceso, el nombre y el correo que escribís. Mientras usás la plataforma se guardan tus objetivos de estudio y tu plan, el material que subas, tus respuestas, tus ejercicios y tu progreso. No se guardan contraseñas.'],
  ['Para qué se usan', 'Solo para que la plataforma funcione: identificarte, adaptar el contenido y el plan a tu avance y mostrarte tu progreso. No se venden ni se comparten con terceros para otros fines, y no se usan para publicidad.'],
  ['Servicios que intervienen', 'Para generar explicaciones, preguntas y ayudas, los textos del tema, tu material y tus respuestas se envían al modelo de lenguaje Claude (Anthropic). Para ejecutar el código de los ejercicios se usa Judge0. Ninguno de los dos recibe tu correo ni tu nombre.'],
  ['Seguridad', 'La conexión es cifrada (HTTPS) y la sesión dura un tiempo limitado. Al cerrar sesión, se invalidan todas las sesiones abiertas de tu cuenta.'],
  ['Tus datos', 'Podés pedir que se borre tu cuenta con todo lo que contiene escribiendo a la autora del trabajo. Los datos se eliminan al finalizar la evaluación del prototipo.'],
]

export default function Privacidad() {
  return (
    <div className="notebook min-h-dvh overflow-x-clip">
      <div className="nb-page nb-lined relative flex min-h-dvh flex-col">
        <PaperTopbar right={<Link to="/" className="text-sm text-muted hover:text-fg">Volver al inicio ↗</Link>} />
        <main className="relative z-[2] mx-auto grid w-full max-w-[44rem] gap-6 px-5 py-12">
          <h1 className="display text-[clamp(1.8rem,3.5vw,2.6rem)]">Política de privacidad</h1>
          {SECCIONES.map(([titulo, texto]) => (
            <section key={titulo} className="grid gap-1.5">
              <h2 className="font-medium">{titulo}</h2>
              <p className="text-[.95rem] leading-relaxed text-muted">{texto}</p>
            </section>
          ))}
          <p className="text-xs text-muted">Autora: Jazmín Bustos · Universidad Siglo 21.</p>
        </main>
      </div>
    </div>
  )
}
