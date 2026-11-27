'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Package } from 'lucide-react'
import GenerarDespiece from './GenerarDespiece'
import { cantidad, porSubconjunto, type MaterialRow } from './tipos'

// Paso 1 (oficina técnica): el despiece de materiales de la obra.
//
// La importación es en dos tiempos a propósito: primero se ve qué interpretó
// el sistema —cómo dedujo el árbol, qué descartó— y recién después se aplica.
// Una estructura mal interpretada deja a abastecimiento buscando materiales
// que no existen.

interface Preview {
  lineas: Array<{
    subconjunto: string; codigo: string; descripcion: string; unidad: string
    cantidad: number; stock: number | null; fila: number
  }>
  subconjuntos: string[]
  metodoSubconjunto: 'columna' | 'nivel' | 'sangria' | 'prefijo' | 'ninguno'
  omitidos: Array<{ fila: number; descripcion: string; motivo: string }>
  advertencias: string[]
}

const COMO_DEDUJO: Record<Preview['metodoSubconjunto'], string> = {
  columna: 'por la columna de subconjunto de la planilla',
  nivel: 'por la columna de nivel',
  sangria: 'por la sangría del árbol',
  prefijo: 'por el prefijo de la obra en el nombre de cada subconjunto',
  ninguno: 'no se pudo deducir: los materiales entran sin agrupar',
}

export default function PanelMateriales({ proyectoId, materiales, puede, onCambio }: {
  proyectoId: string
  materiales: MaterialRow[]
  puede: boolean
  onCambio: () => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [alcance, setAlcance] = useState<{ entrantes: string[]; reemplaza: string[] }>({ entrantes: [], reemplaza: [] })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const enviar = async (file: File, aplicar: boolean) => {
    setCargando(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('proyectoId', proyectoId)
      form.append('archivo', file)
      form.append('aplicar', String(aplicar))
      const res = await fetch('/api/produccion/materiales', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo leer el despiece')
      if (data.aplicado) {
        setPreview(null)
        setArchivo(null)
        if (ref.current) ref.current.value = ''
        onCambio()
      } else {
        setPreview(data.preview)
        setAlcance({ entrantes: data.entrantes ?? [], reemplaza: data.reemplaza ?? [] })
        setArchivo(file)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setCargando(false)
    }
  }

  if (materiales.length > 0) {
    return (
      <div className="space-y-4">
        <ListaMateriales materiales={materiales} />
        {puede && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-brand">
              Sumar o reemplazar un subconjunto
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Cada archivo trae un subconjunto: si ya está cargado se reemplaza, y si no, se agrega.
              Un subconjunto con material ya ingresado no se puede reemplazar.
            </p>
            <Importador ref={ref} cargando={cargando} onArchivo={(f) => enviar(f, false)} />
          </details>
        )}
        {preview && archivo && (
          <Preview
            preview={preview}
            alcance={alcance}
            cargando={cargando}
            onAplicar={() => enviar(archivo, true)}
            onCancelar={() => setPreview(null)}
          />
        )}
        {error && <AvisoError texto={error} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Lo primero es la propuesta: la plataforma ya tiene la geometría de la
          obra, así que el despiece lo propone ella. Subir el archivo queda
          como alternativa, para la primera obra y para los casos especiales. */}
      {puede
        ? <GenerarDespiece proyectoId={proyectoId} onCambio={onCambio} />
        : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Oficina técnica tiene que definir el despiece de materiales antes de que
            abastecimiento pueda verificar el stock.
          </p>}

      {puede && (
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <Package className="mx-auto mb-2 h-7 w-7 text-slate-300" />
          <p className="text-sm font-semibold text-brand-ink">O subí la estructura de producto</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Exportada del sistema de gestión (.xlsx o .csv), un archivo por subconjunto. Hace falta
            la primera vez, cuando todavía no hay ninguna obra parecida de la que escalar, y cuando
            esta obra no se parece a nada de lo hecho.
          </p>
          <Importador ref={ref} cargando={cargando} onArchivo={(f) => enviar(f, false)} />
        </div>
      )}
      {preview && archivo && (
        <Preview
          preview={preview}
          alcance={alcance}
          cargando={cargando}
          onAplicar={() => enviar(archivo, true)}
          onCancelar={() => setPreview(null)}
        />
      )}
      {error && <AvisoError texto={error} />}
    </div>
  )
}

function Importador({ ref, cargando, onArchivo }: {
  ref: React.RefObject<HTMLInputElement | null>
  cargando: boolean
  onArchivo: (f: File) => void
}) {
  return (
    <div className="mt-3">
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.csv,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onArchivo(f)
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={cargando}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        Subir despiece
      </button>
    </div>
  )
}

function Preview({ preview, alcance, cargando, onAplicar, onCancelar }: {
  preview: Preview
  alcance: { entrantes: string[]; reemplaza: string[] }
  cargando: boolean
  onAplicar: () => void
  onCancelar: () => void
}) {
  const hayLineas = preview.lineas.length > 0
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-2 font-bold text-brand-ink">Esto es lo que se va a importar</p>
      <ul className="mb-3 space-y-1 text-sm text-slate-600">
        <li><strong>{preview.lineas.length}</strong> renglones de material</li>
        <li><strong>{preview.subconjuntos.length}</strong> subconjuntos, agrupados {COMO_DEDUJO[preview.metodoSubconjunto]}</li>
        {preview.omitidos.length > 0 && (
          <li><strong>{preview.omitidos.length}</strong> renglones descartados (conjuntos del árbol o sin cantidad)</li>
        )}
        {preview.lineas.some((l) => l.stock != null) && (
          <li>trae el <strong>stock del sistema de gestión</strong>, que queda propuesto en la verificación</li>
        )}
      </ul>

      {/* El ERP exporta un subconjunto por archivo: importar casi siempre
          agrega, y sólo reemplaza el subconjunto que se volvió a exportar. */}
      {alcance.reemplaza.length > 0 ? (
        <p className="mb-3 rounded-lg bg-sky-50 p-3 text-xs text-sky-900">
          Se <strong>reemplaza</strong> {alcance.reemplaza.join(', ')}, que ya estaba cargado. El
          resto del despiece queda como está.
        </p>
      ) : alcance.entrantes.length > 0 ? (
        <p className="mb-3 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
          Se <strong>agrega</strong> {alcance.entrantes.join(', ')} a lo que ya haya cargado.
        </p>
      ) : null}

      {preview.advertencias.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <p className="mb-1 flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> Revisá esto antes de aplicar
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {preview.advertencias.slice(0, 8).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {hayLineas && (
        <div className="mb-3 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-left text-slate-500">
              <tr>
                <th className="p-2">Subconjunto</th>
                <th className="p-2">Código</th>
                <th className="p-2">Artículo</th>
                <th className="p-2 text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {preview.lineas.slice(0, 50).map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-2 text-slate-500">{l.subconjunto || '—'}</td>
                  <td className="p-2 text-slate-500">{l.codigo || '—'}</td>
                  <td className="p-2">{l.descripcion}</td>
                  <td className="p-2 text-right font-semibold">{cantidad(l.cantidad, l.unidad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.lineas.length > 50 && (
            <p className="p-2 text-center text-xs text-slate-400">
              y {preview.lineas.length - 50} renglones más
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAplicar}
          disabled={cargando || !hayLineas}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {alcance.reemplaza.length > 0 ? 'Reemplazar' : 'Agregar'} {preview.lineas.length} renglones
        </button>
        <button type="button" onClick={onCancelar} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function ListaMateriales({ materiales }: { materiales: MaterialRow[] }) {
  const grupos = porSubconjunto(materiales)
  return (
    <div className="space-y-3">
      {grupos.map(([nombre, filas]) => (
        <div key={nombre} className="overflow-hidden rounded-xl border border-slate-200">
          <p className="bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">{nombre}</p>
          <table className="w-full text-sm">
            <tbody>
              {filas.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-400">{m.codigo || '—'}</td>
                  <td className="px-3 py-2">{m.descripcion}</td>
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    {cantidad(m.cantidad_requerida, m.unidad)}
                  </td>
                  <td className="px-3 py-2 text-right"><Chip estado={m.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

const CHIP: Record<MaterialRow['estado'], { texto: string; clase: string }> = {
  pendiente: { texto: 'Sin verificar', clase: 'bg-slate-100 text-slate-500' },
  disponible: { texto: 'En depósito', clase: 'bg-emerald-100 text-emerald-700' },
  faltante: { texto: 'Falta', clase: 'bg-red-100 text-red-700' },
  pedido: { texto: 'Pedido', clase: 'bg-amber-100 text-amber-700' },
  recibido: { texto: 'Recibido', clase: 'bg-emerald-100 text-emerald-700' },
}

export function Chip({ estado }: { estado: MaterialRow['estado'] }) {
  const c = CHIP[estado]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${c.clase}`}>{c.texto}</span>
}

export function AvisoError({ texto }: { texto: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <AlertTriangle className="h-4 w-4 shrink-0" /> {texto}
    </p>
  )
}
