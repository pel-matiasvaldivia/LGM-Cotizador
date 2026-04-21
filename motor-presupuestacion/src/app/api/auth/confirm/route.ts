import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Confirms an unconfirmed user's email via admin API.
// Security: the user still needs the correct password to sign in after this.
export async function POST(req: Request) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  const user = users.find(u => u.email === email)
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (user.email_confirmed_at) {
    return NextResponse.json({ success: true, alreadyConfirmed: true })
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
