import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, password, nombre } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombre ?? '' },
  })

  if (error) {
    // Si ya existe, no es un error real — el cliente puede intentar login
    const alreadyExists =
      error.message.toLowerCase().includes('already') ||
      error.message.toLowerCase().includes('exists') ||
      error.code === 'email_exists'

    return NextResponse.json(
      { error: error.message, alreadyExists },
      { status: alreadyExists ? 409 : 400 }
    )
  }

  return NextResponse.json({ success: true })
}
