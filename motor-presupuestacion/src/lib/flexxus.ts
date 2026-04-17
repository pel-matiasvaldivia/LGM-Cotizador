// lib/flexxus.ts — Integración con ERP Flexxus

export interface FlexxusRubro {
  codigo_rubro: number
  codigo_subrubro: number
  descripcion: string
  importe: number
  moneda: 'ARS' | 'USD'
}

export interface FlexxusProyecto {
  codigo: string
  descripcion: string
  cliente: string
  fecha_inicio: string
  rubros: FlexxusRubro[]
}

export async function sincronizarConFlexxus(proyectoId: string, cliente: string, items: any[]) {
  const payload: FlexxusProyecto = {
    codigo: `PROY-${proyectoId.slice(0, 8).toUpperCase()}`,
    descripcion: 'Generado desde Motor de Presupuestación Log Metal SRL',
    cliente,
    fecha_inicio: new Date().toISOString().split('T')[0],
    rubros: items.map(item => ({
      codigo_rubro: item.rubro?.codigo_flexxus ?? 0,
      codigo_subrubro: item.subrubro?.codigo_flexxus ?? 0,
      descripcion: item.descripcion,
      importe: item.costo_total_usd,
      moneda: 'USD',
    })),
  }

  const flexxusUrl = process.env.FLEXXUS_API_URL
  const flexxusKey = process.env.FLEXXUS_API_KEY

  // Opción A: API REST Flexxus (si está disponible)
  if (flexxusUrl && flexxusKey) {
    const response = await fetch(`${flexxusUrl}/proyectos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${flexxusKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      return { metodo: 'api', ...await response.json() }
    }

    console.warn('Flexxus API no disponible, usando exportación CSV como fallback')
  }

  // Opción B: Fallback — Generar CSV para importación manual
  return { metodo: 'csv', csv: generarCSVFlexxus(payload) }
}

function generarCSVFlexxus(payload: FlexxusProyecto): string {
  const header = 'CODIGO_PROYECTO,FECHA,DESCRIPCION,CLIENTE,CODIGO_RUBRO,CODIGO_SUBRUBRO,DESCRIPCION_RUBRO,IMPORTE,MONEDA'
  const rows = payload.rubros.map(r =>
    [payload.codigo, payload.fecha_inicio, payload.descripcion, payload.cliente,
     r.codigo_rubro, r.codigo_subrubro, r.descripcion, r.importe, r.moneda].join(',')
  )
  return [header, ...rows].join('\n')
}
