import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Usuarios hardcodeados para el prototipo
const USUARIOS_SEED = [
  {
    email: 'comercial@logmetal.com',
    password: 'LogMetal2026!',
    nombre: 'Equipo Comercial',
    rol: 'comercial',
  },
  {
    email: 'admin@logmetal.com',
    password: 'LogMetal2026!',
    nombre: 'Administrador',
    rol: 'admin',
  },
]

export async function POST(req: Request) {
  // Protección básica: requiere un token secreto para no exponerlo públicamente
  const { token } = await req.json().catch(() => ({}))
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const resultados = []

  for (const usuario of USUARIOS_SEED) {
    // Intentar crear el usuario (ignorar si ya existe)
    const { data, error } = await supabase.auth.admin.createUser({
      email: usuario.email,
      password: usuario.password,
      email_confirm: true,
      user_metadata: { nombre: usuario.nombre, rol: usuario.rol },
    })

    if (error && !error.message.includes('already been registered')) {
      resultados.push({ email: usuario.email, status: 'error', message: error.message })
      continue
    }

    if (data?.user) {
      // Upsert en perfiles (el trigger lo crea pero por si acaso)
      await supabase.from('perfiles').upsert({
        id: data.user.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
      })
      resultados.push({ email: usuario.email, status: 'creado' })
    } else {
      resultados.push({ email: usuario.email, status: 'ya existe' })
    }
  }

  return NextResponse.json({ ok: true, resultados })
}
