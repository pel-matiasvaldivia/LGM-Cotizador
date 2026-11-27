import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { AuthError } from '@/lib/errors'
import { requireOrdenDelProyecto } from '@/lib/scope'
import { cargarMateriales, requireSector } from '@/lib/produccion'
import { filasDesdeCsv, interpretarDespiece } from '@/lib/despiece-import'
import { leerXlsx } from '@/lib/xlsx-lite'

// Despiece de materiales de la obra (oficina técnica).
//
// Dos pasos a propósito: primero se sube el archivo y se devuelve el PREVIEW
// —qué interpretó, cómo dedujo el árbol, qué descartó— y recién después se
// aplica. Importar a ciegas una estructura de producto mal interpretada deja a
// abastecimiento verificando materiales que no existen.

const MAX_BYTES = 8 * 1024 * 1024

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])
  requireSector(user, 'oficina_tecnica')

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Se espera multipart/form-data' }, { status: 400 })

  const proyectoId = String(form.get('proyectoId') ?? '')
  if (!isUuid(proyectoId)) return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })

  const orden = await requireOrdenDelProyecto(proyectoId)
  const aplicar = String(form.get('aplicar') ?? '') === 'true'

  const archivo = form.get('archivo')
  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo del despiece' }, { status: 400 })
  }
  if (archivo.size > MAX_BYTES) {
    throw new AuthError('El archivo supera los 8 MB', 400)
  }

  const buffer = Buffer.from(await archivo.arrayBuffer())
  const filas = archivo.name.toLowerCase().endsWith('.xlsx')
    ? (leerXlsx(buffer)[0]?.filas ?? [])
    : filasDesdeCsv(buffer.toString('utf8'))

  const preview = interpretarDespiece(filas)
  if (!aplicar || preview.lineas.length === 0) {
    return NextResponse.json({ preview, aplicado: false })
  }

  const cantidad = await cargarMateriales(orden, preview.lineas, 'flexxus', user)
  return NextResponse.json({ preview, aplicado: true, renglones: cantidad })
})
