import React from 'react'
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { EmisorPDF } from '@/lib/pdf-emisor'
import type {
  Despacho, DespachoItem, MaterialOrden, OrdenCompra, OrdenCompraItem, OrdenProduccion, Proyecto,
} from '@/db/schema'
import { Dato, Encabezado, estilos, fecha } from '@/lib/pdf-cierre'

// Los dos papeles que el circuito de producción saca a la calle: el pedido de
// materiales que va a compras y el remito que viaja con el camión.
//
// Ninguno lleva precios. La OC de referencia es el pedido de ESTA obra, no la
// orden de compra del ERP: el precio lo negocia compras. Y el remito lo firma
// alguien en la obra, que no tiene por qué ver lo que costó.

function num(n: number, decimales = 2): string {
  return Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

function Tabla({ emisor, columnas, filas }: {
  emisor: EmisorPDF
  columnas: Array<{ titulo: string; ancho: number; alinear?: 'left' | 'right' | 'center' }>
  filas: string[][]
}) {
  const s = estilos(emisor)
  return (
    <View>
      <View style={{ ...s.fila, backgroundColor: '#F3F4F6', borderBottomWidth: 1.5, borderBottomColor: emisor.colorMarca }}>
        {columnas.map((c) => (
          <Text
            key={c.titulo}
            style={{ ...s.celda, width: `${c.ancho}%`, fontWeight: 'bold', fontSize: 8, textAlign: c.alinear ?? 'left' }}
          >
            {c.titulo}
          </Text>
        ))}
      </View>
      {filas.map((fila, i) => (
        <View key={i} style={s.fila} wrap={false}>
          {fila.map((valor, j) => (
            <Text key={j} style={{ ...s.celda, width: `${columnas[j].ancho}%`, textAlign: columnas[j].alinear ?? 'left' }}>
              {valor}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function Pie({ texto }: { texto: string }) {
  return (
    <Text
      style={{ position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7, color: '#9CA3AF', textAlign: 'center' }}
      fixed
    >
      {texto}
    </Text>
  )
}

/* ─── Orden de compra de referencia ───────────────────────────── */

export async function generarOrdenCompraPDF(
  oc: OrdenCompra & { items: OrdenCompraItem[] },
  materiales: MaterialOrden[],
  orden: OrdenProduccion,
  proyecto: Proyecto,
  emisor: EmisorPDF,
): Promise<Buffer> {
  const s = estilos(emisor)
  const porId = new Map(materiales.map((m) => [m.id, m]))

  const filas = oc.items.map((item) => {
    const m = porId.get(item.materialId)
    return [
      m?.codigo || '—',
      m?.descripcion || '—',
      m?.subconjunto || '—',
      `${num(item.cantidad, 2)} ${m?.unidad ?? ''}`.trim(),
    ]
  })

  const doc = (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Encabezado
          emisor={emisor}
          titulo="PEDIDO DE MATERIALES"
          numero={oc.numero}
          subtitulo="ORDEN DE COMPRA DE REFERENCIA — USO INTERNO"
        />

        <Text style={s.h2}>DESTINO</Text>
        <Dato k="Obra" v={`${proyecto.codigo} · ${proyecto.razonSocial || proyecto.cliente}`} />
        <Dato k="Orden de producción" v={orden.numero} />
        <Dato k="Ubicación" v={proyecto.ubicacion || '—'} />
        <Dato k="Entrega comprometida" v={fecha(orden.fechaEntregaComprometida)} />
        <Dato k="Necesario para" v={oc.fechaNecesidad ? fecha(oc.fechaNecesidad) : 'A definir'} />
        {oc.proveedor ? <Dato k="Proveedor sugerido" v={oc.proveedor} /> : null}

        <Text style={s.h2}>MATERIALES A COMPRAR</Text>
        <Tabla
          emisor={emisor}
          columnas={[
            { titulo: 'Código', ancho: 12 },
            { titulo: 'Artículo', ancho: 48 },
            { titulo: 'Subconjunto', ancho: 25 },
            { titulo: 'Cantidad', ancho: 15, alinear: 'right' },
          ]}
          filas={filas}
        />
        <Text style={{ fontSize: 8, color: '#666', marginTop: 6 }}>
          {filas.length} renglones. Las cantidades son las que faltan después de verificar el stock
          de depósito para esta obra.
        </Text>

        {oc.notas ? (
          <>
            <Text style={s.h2}>OBSERVACIONES</Text>
            <Text>{oc.notas}</Text>
          </>
        ) : null}

        <View style={{ marginTop: 24, padding: 8, backgroundColor: '#FEF3C7' }}>
          <Text style={{ fontSize: 8 }}>
            Este pedido no reemplaza a la orden de compra del sistema de gestión: es el
            requerimiento de esta obra, para que compras lo gestione y el circuito pueda seguirlo.
            Al cursarlo, anotá la referencia del ERP en la plataforma.
          </Text>
        </View>

        <Pie texto={`${emisor.razonSocial} · ${oc.numero} · Documento interno`} />
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}

/* ─── Remito de despacho ──────────────────────────────────────── */

export async function generarRemitoPDF(
  despacho: Despacho & { items: DespachoItem[] },
  orden: OrdenProduccion,
  proyecto: Proyecto,
  emisor: EmisorPDF,
): Promise<Buffer> {
  const s = estilos(emisor)

  const doc = (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Encabezado
          emisor={emisor}
          titulo="REMITO DE DESPACHO"
          numero={despacho.numero}
          subtitulo="DESPACHO DE PARTES A OBRA"
        />

        <Text style={s.h2}>OBRA Y DESTINO</Text>
        <Dato k="Obra" v={`${proyecto.codigo} · ${proyecto.razonSocial || proyecto.cliente}`} />
        <Dato k="Orden de producción" v={orden.numero} />
        <Dato k="Destino" v={despacho.destino || proyecto.ubicacion || '—'} />
        <Dato k="Fecha de salida" v={despacho.fechaSalida ? fecha(despacho.fechaSalida) : '—'} />
        {despacho.transporte ? <Dato k="Transporte" v={despacho.transporte} /> : null}
        {despacho.chofer || despacho.patente ? (
          <Dato k="Chofer / patente" v={[despacho.chofer, despacho.patente].filter(Boolean).join(' · ')} />
        ) : null}

        <Text style={s.h2}>PARTES DESPACHADAS</Text>
        <Tabla
          emisor={emisor}
          columnas={[
            { titulo: 'Parte', ancho: 60 },
            { titulo: 'Cantidad', ancho: 20, alinear: 'right' },
            { titulo: 'Recibido', ancho: 20, alinear: 'center' },
          ]}
          filas={despacho.items.map((i) => [
            i.descripcion,
            `${num(i.cantidad, 2)} ${i.unidad}`.trim(),
            // Se completa a mano en la obra cuando el remito viaja impreso.
            despacho.recibidoAt ? `${num(i.cantidadRecibida, 2)} ${i.unidad}`.trim() : '__________',
          ])}
        />

        {despacho.observaciones ? (
          <>
            <Text style={s.h2}>OBSERVACIONES</Text>
            <Text>{despacho.observaciones}</Text>
          </>
        ) : null}

        <Text style={s.h2}>CONFORMIDAD DE RECEPCIÓN EN OBRA</Text>
        {despacho.recibidoAt ? (
          <View style={{ padding: 8, backgroundColor: '#ECFDF5' }}>
            <Dato k="Recibido por" v={despacho.recibidoPor} />
            <Dato k="Fecha y hora" v={despacho.recibidoAt.toLocaleString('es-AR')} />
            <Dato k="Estado" v={ESTADO_CONFORMIDAD[despacho.conformidad] ?? despacho.conformidad} />
            {despacho.observacionesObra ? <Dato k="Observaciones" v={despacho.observacionesObra} /> : null}
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 20 }}>
              Quien recibe deja constancia de que las partes detalladas llegaron en las cantidades
              indicadas. Las diferencias o daños se anotan acá y se cargan en la plataforma.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 }}>
              {['Firma', 'Aclaración', 'DNI', 'Fecha'].map((t) => (
                <View key={t} style={{ width: '22%', borderTopWidth: 1, borderTopColor: '#9CA3AF', paddingTop: 4 }}>
                  <Text style={{ fontSize: 8, color: '#666' }}>{t}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Pie texto={`${emisor.razonSocial} · ${despacho.numero} · ${proyecto.codigo}`} />
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}

const ESTADO_CONFORMIDAD: Record<string, string> = {
  conforme: 'Conforme',
  con_observaciones: 'Recibido con observaciones',
  rechazado: 'Rechazado',
}
