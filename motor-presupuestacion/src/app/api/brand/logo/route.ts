import { NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/api-helpers'
import { getTenant } from '@/lib/tenant'

// Sirve el logo que la empresa cargó desde Configuración → Empresa. Se guarda
// en la base (no en disco) para que el mismo contenedor pueda servir a varios
// dominios sin volúmenes por tenant.
//
// La URL lleva `t` (slug) y `v` (updatedAt): el slug hace que la URL sea única
// por empresa —necesario para que cualquier caché intermedia no mezcle logos de
// dos dominios— y `v` invalida el anterior al subir uno nuevo. Igual el que
// manda es el Host: `t` no selecciona empresa.
export const GET = withErrorHandling(async (req: Request) => {
  const tenant = await getTenant()
  const oscuro = new URL(req.url).searchParams.get('variante') === 'oscuro'

  const base64 = oscuro ? tenant?.logoOscuroBase64 : tenant?.logoBase64
  const mime = (oscuro ? tenant?.logoOscuroMime : tenant?.logoMime) || 'image/png'

  if (!tenant || !base64) {
    return NextResponse.json({ error: 'La empresa no tiene logo cargado' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(Buffer.from(base64, 'base64')), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=86400',
    },
  })
})
