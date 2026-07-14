import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import { aplicarBase0 } from '@/lib/base0-catalogo'
import { resolverMapeoRubro } from '@/lib/flexxus'
import type { PreviewBase0, RubroImportado } from '@/lib/base0-import'

// Reconstruye un RubroImportado saneado a partir de input no confiable: recalcula
// código Flexxus y totales del servidor, ignorando lo que mande el cliente salvo
// los valores por m² (que el usuario pudo editar en el preview).
function sanearRubro(raw: unknown): RubroImportado | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const nombreOriginal = typeof o.nombreOriginal === 'string' ? o.nombreOriginal.trim() : ''
  if (!nombreOriginal) return null

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
  const material = num(o.materialUsdM2)
  const moFab = num(o.moFabUsdM2)
  const moMontaje = num(o.moMontajeUsdM2)
  const total = material + moFab + moMontaje
  if (total <= 0) return null

  const rubroCatalogo = typeof o.rubroCatalogo === 'string' ? o.rubroCatalogo : null
  const mapeo = rubroCatalogo ? resolverMapeoRubro(rubroCatalogo) : null

  return {
    nombreOriginal,
    rubroCatalogo: mapeo ? rubroCatalogo : null,
    codigoFlexxus: mapeo ? mapeo.codigoRubro : null,
    materialUsdM2: material,
    moFabUsdM2: moFab,
    moMontajeUsdM2: moMontaje,
    totalUsdM2: total,
    subrubros: [],
  }
}

// POST { preview } → aplica el preview al catálogo (reemplaza los rubros
// presentes). Sólo admin: muta el catálogo de ratios.
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['admin'])

  const body = await req.json().catch(() => null)
  const rubrosRaw = body?.preview?.rubros
  if (!Array.isArray(rubrosRaw)) {
    return NextResponse.json({ error: 'Falta el preview a aplicar' }, { status: 400 })
  }

  const rubros = rubrosRaw.map(sanearRubro).filter((r): r is RubroImportado => r !== null)
  if (rubros.length === 0) {
    return NextResponse.json({ error: 'No hay rubros válidos para importar' }, { status: 400 })
  }

  const preview: PreviewBase0 = {
    rubros,
    sinMapear: rubros.filter((r) => r.codigoFlexxus === null).map((r) => r.nombreOriginal),
    advertencias: [],
  }

  const resultado = await aplicarBase0(preview)
  return NextResponse.json({ resultado })
})
