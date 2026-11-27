import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer'
import type { EmisorPDF } from '@/lib/pdf-emisor'
import type { Contrato, OrdenProduccion, Proyecto } from '@/db/schema'
import type { SnapshotPresupuesto } from '@/lib/cierre'

// Los dos documentos del cierre de la venta: el contrato que firma el cliente y
// la orden de producción que recibe oficina técnica.
//
// Los dos salen del snapshot congelado en el contrato, nunca de un recálculo:
// un documento emitido tiene que decir siempre lo mismo.
//
// Y los dos los firma una empresa concreta (multi-tenant): su marca y sus datos
// fiscales llegan por `emisor`.

export function estilos(emisor: EmisorPDF) {
  return StyleSheet.create({
    page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', lineHeight: 1.4 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
    emisorLinea: { fontSize: 7, color: '#666', marginTop: 1 },
    h1: { fontSize: 13, fontWeight: 'bold', color: emisor.colorMarca },
    h2: {
      fontSize: 9,
      fontWeight: 'bold',
      color: 'white',
      backgroundColor: emisor.colorMarca,
      padding: 5,
      marginTop: 14,
      marginBottom: 6,
    },
    fila: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    celda: { padding: 4 },
    clausula: { marginBottom: 6, textAlign: 'justify' },
  })
}

export function fecha(valor: Date | string | null | undefined): string {
  if (!valor) return '—'
  const d = typeof valor === 'string' ? new Date(`${valor}T00:00:00Z`) : valor
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function usd(n: number | null | undefined): string {
  return 'u$d ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function Encabezado({ emisor, titulo, numero, subtitulo }: {
  emisor: EmisorPDF
  titulo: string
  numero: string
  subtitulo: string
}) {
  const s = estilos(emisor)
  return (
    <View style={s.header}>
      <View style={{ maxWidth: 300 }}>
        {emisor.logo
          ? <Image src={emisor.logo} style={{ width: 130, height: 'auto' }} />
          : <Text style={s.h1}>{emisor.razonSocial}</Text>}
        {emisor.logo ? <Text style={{ fontSize: 9, fontWeight: 'bold', color: emisor.colorMarca, marginTop: 4 }}>{emisor.razonSocial}</Text> : null}
        {emisor.cuit ? <Text style={s.emisorLinea}>CUIT: {emisor.cuit}</Text> : null}
        {emisor.domicilio ? <Text style={s.emisorLinea}>{emisor.domicilio}</Text> : null}
        {[emisor.telefono, emisor.email, emisor.web].filter(Boolean).length > 0 ? (
          <Text style={s.emisorLinea}>{[emisor.telefono, emisor.email, emisor.web].filter(Boolean).join(' · ')}</Text>
        ) : null}
        <Text style={{ fontSize: 8, color: '#888', marginTop: 4 }}>{subtitulo}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: emisor.colorMarca }}>{titulo}</Text>
        <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>N° {numero}</Text>
        <Text style={{ fontSize: 8, color: '#888', marginTop: 2 }}>Fecha: {fecha(new Date())}</Text>
      </View>
    </View>
  )
}

export function Dato({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
      <Text style={{ width: 130, color: '#666' }}>{k}</Text>
      <Text style={{ flex: 1, fontWeight: 'bold' }}>{v}</Text>
    </View>
  )
}

/* ─── Contrato ────────────────────────────────────────────────── */

export async function generarContratoPDF(
  contrato: Contrato,
  proyecto: Proyecto,
  emisor: EmisorPDF,
): Promise<Buffer> {
  const s = estilos(emisor)
  const snap = (contrato.snapshot ?? {}) as unknown as SnapshotPresupuesto
  const dt = (snap.datosTecnicos ?? {}) as Record<string, unknown>
  const comitente = proyecto.razonSocial || proyecto.cliente

  // El detalle va por rubro: el cliente firma el alcance, no el despiece.
  const porRubro = new Map<string, number>()
  for (const item of snap.items ?? []) {
    porRubro.set(item.rubro, (porRubro.get(item.rubro) || 0) + Number(item.precioVentaUsd || 0))
  }

  const saldoPct = Math.max(0, 100 - Number(contrato.anticipoPct || 0))

  const doc = (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Encabezado
          emisor={emisor}
          titulo="CONTRATO DE OBRA"
          numero={contrato.numero}
          subtitulo="CONTRATO — PROVISIÓN Y MONTAJE DE ESTRUCTURA METÁLICA"
        />

        <Text style={s.clausula}>
          Entre <Text style={{ fontWeight: 'bold' }}>{emisor.razonSocial}</Text>
          {emisor.cuit ? `, CUIT ${emisor.cuit}` : ''}
          {emisor.domicilio ? `, con domicilio en ${emisor.domicilio}` : ''}, en adelante
          «LA CONTRATISTA», y <Text style={{ fontWeight: 'bold' }}>{comitente}</Text>
          {proyecto.dni ? `, DNI/CUIT ${proyecto.dni}` : ''}, en adelante «EL COMITENTE», se
          acuerda celebrar el presente contrato de obra, que se regirá por las cláusulas
          siguientes y por el presupuesto {proyecto.codigo} que EL COMITENTE aprobó y que
          forma parte integrante de este contrato.
        </Text>

        <Text style={s.h2}>PRIMERA — OBJETO Y ALCANCE</Text>
        <Dato k="Obra" v={proyecto.codigo} />
        <Dato k="Ubicación" v={proyecto.ubicacion || 'A designar por EL COMITENTE'} />
        <Dato k="Tipología" v={String(dt.tipologia || '—').replace(/_/g, ' ')} />
        <Dato k="Dimensiones" v={`${dt.ancho || '—'} m × ${dt.largo || '—'} m × ${dt.alturaLibre || '—'} m de altura libre`} />
        <Dato k="Superficie cubierta" v={`${Number(dt.superficie || 0).toLocaleString('es-AR')} m²`} />
        <Dato k="Cubierta" v={String(dt.tipoCubierta || '—').replace(/_/g, ' ')} />
        <Text style={{ marginTop: 6 }}>
          El alcance comprende los rubros detallados en la cláusula SEGUNDA. Todo trabajo,
          material o servicio no enumerado allí queda expresamente excluido.
        </Text>

        <Text style={s.h2}>SEGUNDA — RUBROS COMPRENDIDOS</Text>
        <View style={[s.fila, { backgroundColor: '#E0E7F0' }]}>
          <Text style={[s.celda, { flex: 4, fontWeight: 'bold' }]}>Rubro</Text>
          <Text style={[s.celda, { flex: 1.5, fontWeight: 'bold', textAlign: 'right' }]}>Importe</Text>
        </View>
        {[...porRubro.entries()].map(([rubro, monto], i) => (
          <View key={rubro} style={[s.fila, { backgroundColor: i % 2 === 0 ? 'white' : '#F8FAFB' }]}>
            <Text style={[s.celda, { flex: 4 }]}>{rubro}</Text>
            <Text style={[s.celda, { flex: 1.5, textAlign: 'right' }]}>{usd(monto)}</Text>
          </View>
        ))}

        <Text style={s.h2}>TERCERA — PRECIO</Text>
        <Dato k="Subtotal sin IVA" v={usd(contrato.montoSinIvaUsd)} />
        <Dato k="IVA" v={usd(contrato.ivaUsd)} />
        <Dato k="TOTAL" v={usd(contrato.montoTotalUsd)} />
        <Text style={{ marginTop: 6 }}>
          Los importes se expresan en dólares estadounidenses. Su conversión a pesos se
          practicará al tipo de cambio Dólar Oficial BNA vendedor del día anterior a cada pago
          {contrato.tipoCambio ? ` (referencia a la fecha de este contrato: $${Number(contrato.tipoCambio).toLocaleString('es-AR')})` : ''}.
        </Text>

        <Text style={s.h2}>CUARTA — FORMA DE PAGO</Text>
        <Dato k="Anticipo" v={`${Number(contrato.anticipoPct || 0).toLocaleString('es-AR')}% — ${usd(Number(contrato.montoTotalUsd || 0) * Number(contrato.anticipoPct || 0) / 100)}`} />
        <Dato k="Saldo" v={`${saldoPct.toLocaleString('es-AR')}% — ${usd(Number(contrato.montoTotalUsd || 0) * saldoPct / 100)}`} />
        {contrato.formaPago ? <Dato k="Condiciones" v={contrato.formaPago} /> : null}
        <Text style={{ marginTop: 6 }}>
          El anticipo es condición para el inicio de los trabajos: los plazos de la cláusula
          QUINTA corren desde su acreditación.
        </Text>

        <Text style={s.h2}>QUINTA — PLAZO DE ENTREGA</Text>
        <Dato k="Plazo comprometido" v={`${contrato.plazoEntregaDias} días corridos`} />
        <Dato k="Inicio previsto" v={fecha(contrato.fechaInicio)} />
        <Dato k="Lugar de entrega" v={contrato.lugarEntrega || proyecto.ubicacion || 'A designar'} />
        <Text style={{ marginTop: 6 }}>
          El plazo se suspende por causas no imputables a LA CONTRATISTA: demoras del
          COMITENTE en pagos, aprobaciones o accesos a la obra, y casos fortuitos o de fuerza
          mayor. LA CONTRATISTA notificará por escrito toda suspensión y su causa.
        </Text>

        {contrato.garantiaMeses > 0 ? (
          <>
            <Text style={s.h2}>SEXTA — GARANTÍA</Text>
            <Text>
              LA CONTRATISTA garantiza la estructura provista por {contrato.garantiaMeses} meses
              contados desde la entrega, contra defectos de fabricación y montaje. La garantía no
              cubre daños por uso indebido, modificaciones de terceros ni falta de mantenimiento.
            </Text>
          </>
        ) : null}

        <Text style={s.h2}>{contrato.garantiaMeses > 0 ? 'SÉPTIMA' : 'SEXTA'} — OBLIGACIONES DEL COMITENTE</Text>
        <Text>
          EL COMITENTE proveerá el acceso al predio, el terreno nivelado y libre, y las
          conexiones de agua y energía necesarias para los trabajos. Son a su cargo los
          permisos municipales, los estudios de suelo y toda tramitación ante organismos.
        </Text>

        {contrato.observaciones ? (
          <>
            <Text style={s.h2}>CONDICIONES PARTICULARES</Text>
            <Text>{contrato.observaciones}</Text>
          </>
        ) : null}

        <Text style={s.h2}>CONFORMIDAD</Text>
        {contrato.firmadoAt ? (
          <View style={{ padding: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC' }}>
            <Text style={{ fontWeight: 'bold', color: '#15803D' }}>
              Contrato firmado {contrato.firmaMetodo === 'digital' ? 'digitalmente' : ''}
            </Text>
            <Text style={{ marginTop: 3 }}>Firmado por: {contrato.firmadoPor}</Text>
            {contrato.firmadoEmail ? <Text>Email: {contrato.firmadoEmail}</Text> : null}
            <Text>Fecha y hora: {new Date(contrato.firmadoAt).toLocaleString('es-AR')}</Text>
            {contrato.firmaReferencia ? (
              <Text style={{ fontSize: 7, color: '#666', marginTop: 3 }}>Referencia: {contrato.firmaReferencia}</Text>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', marginTop: 30, gap: 40 }}>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#999', paddingTop: 4 }}>
              <Text style={{ fontSize: 8 }}>LA CONTRATISTA</Text>
              <Text style={{ fontSize: 7, color: '#666' }}>{emisor.razonSocial}</Text>
            </View>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#999', paddingTop: 4 }}>
              <Text style={{ fontSize: 8 }}>EL COMITENTE</Text>
              <Text style={{ fontSize: 7, color: '#666' }}>{comitente}</Text>
            </View>
          </View>
        )}

        <Text
          style={{ position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7, color: '#999', textAlign: 'center' }}
          render={({ pageNumber, totalPages }) => `${contrato.numero} · ${emisor.razonSocial} · Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )

  return await renderToBuffer(doc)
}

/* ─── Orden de producción ─────────────────────────────────────── */

export async function generarOrdenProduccionPDF(
  orden: OrdenProduccion,
  contrato: Contrato | null,
  proyecto: Proyecto,
  emisor: EmisorPDF,
): Promise<Buffer> {
  const s = estilos(emisor)
  const snap = (orden.snapshot ?? {}) as unknown as SnapshotPresupuesto
  const dt = (snap.datosTecnicos ?? {}) as Record<string, unknown>
  const items = snap.items ?? []

  const si = (v: unknown) => (v ? 'SÍ' : 'NO')

  // Al taller le interesa el despiece por rubro y las horas de mano de obra,
  // no el precio de venta.
  const porRubro = new Map<string, typeof items>()
  for (const item of items) {
    if (!porRubro.has(item.rubro)) porRubro.set(item.rubro, [])
    porRubro.get(item.rubro)!.push(item)
  }

  const toneladas = items
    .filter((i) => (i.unidad === 'kg' || i.unidad === 'kg/m2') && i.rubro.toLowerCase().includes('estructura'))
    .reduce((acc, i) => acc + Number(i.cantidad || 0), 0) / 1000

  const prioridades: Record<string, string> = { baja: 'BAJA', normal: 'NORMAL', alta: 'ALTA' }

  // El desglose de mano de obra en fabricación y montaje depende del catálogo:
  // si no está cargado, dos columnas en cero no le dicen nada al taller y se
  // muestra la mano de obra total.
  const haySplitMo = items.some((i) => Number(i.costoMoFabUsd || 0) > 0 || Number(i.costoMoMontajeUsd || 0) > 0)

  const doc = (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Encabezado
          emisor={emisor}
          titulo="ORDEN DE PRODUCCIÓN"
          numero={orden.numero}
          subtitulo="DOCUMENTO INTERNO — OFICINA TÉCNICA Y TALLER"
        />

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          <View style={{ flex: 1, padding: 8, backgroundColor: '#F8F9FA' }}>
            <Text style={{ fontSize: 7, color: '#888' }}>ENTREGA COMPROMETIDA</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: emisor.colorAcento }}>
              {fecha(orden.fechaEntregaComprometida)}
            </Text>
          </View>
          <View style={{ flex: 1, padding: 8, backgroundColor: '#F8F9FA' }}>
            <Text style={{ fontSize: 7, color: '#888' }}>PRIORIDAD</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{prioridades[orden.prioridad] || 'NORMAL'}</Text>
          </View>
          <View style={{ flex: 1, padding: 8, backgroundColor: '#F8F9FA' }}>
            <Text style={{ fontSize: 7, color: '#888' }}>TN ESTRUCTURA</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>
              {toneladas > 0 ? `${toneladas.toFixed(2)} tn` : 'a definir'}
            </Text>
          </View>
        </View>

        <Text style={s.h2}>OBRA Y CLIENTE</Text>
        <Dato k="Proyecto" v={proyecto.codigo} />
        <Dato k="Cliente" v={proyecto.razonSocial || proyecto.cliente} />
        <Dato k="Contacto" v={[proyecto.contacto || proyecto.cliente, proyecto.telefono, proyecto.email].filter(Boolean).join(' · ')} />
        <Dato k="Ubicación de obra" v={proyecto.ubicacion || '—'} />
        {contrato ? <Dato k="Contrato" v={`${contrato.numero} · firmado ${fecha(contrato.firmadoAt)}`} /> : null}
        {contrato ? <Dato k="Plazo contractual" v={`${contrato.plazoEntregaDias} días corridos desde ${fecha(contrato.fechaInicio)}`} /> : null}

        <Text style={s.h2}>ESPECIFICACIONES TÉCNICAS</Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Dato k="Tipología" v={String(dt.tipologia || '—').replace(/_/g, ' ')} />
            <Dato k="Ancho" v={`${dt.ancho || '—'} m`} />
            <Dato k="Largo" v={`${dt.largo || '—'} m`} />
            <Dato k="Altura libre" v={`${dt.alturaLibre || '—'} m`} />
            <Dato k="Superficie" v={`${Number(dt.superficie || 0).toLocaleString('es-AR')} m²`} />
          </View>
          <View style={{ flex: 1 }}>
            <Dato k="Cubierta" v={String(dt.tipoCubierta || '—').replace(/_/g, ' ')} />
            <Dato k="Cerramiento" v={String(dt.tipoCerramiento || '—').replace(/_/g, ' ')} />
            <Dato k="Portones" v={dt.incluyePortones ? `SÍ (${dt.cantidadPortones || 1})` : 'NO'} />
            <Dato k="Distancia a obra" v={dt.distanciaObraKm ? `${dt.distanciaObraKm} km` : '—'} />
          </View>
        </View>

        <Text style={s.h2}>ALCANCE SOLICITADO POR EL CLIENTE</Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Dato k="Fabricación" v={si(dt.incluyeFabricacion)} />
            <Dato k="Montaje en obra" v={si(dt.incluyeMontaje)} />
            <Dato k="Cubierta" v={si(dt.incluyeCubierta)} />
            <Dato k="Cerramiento lateral" v={si(dt.incluyeCerramientoLateral)} />
          </View>
          <View style={{ flex: 1 }}>
            <Dato k="Piso industrial" v={si(dt.incluyePiso)} />
            <Dato k="Instalación eléctrica" v={si(dt.incluyeElectrica)} />
            <Dato k="Instalación sanitaria" v={si(dt.incluyeSanitaria)} />
          </View>
        </View>

        {dt.especificacionesAdicionales ? (
          <>
            <Text style={s.h2}>ESPECIFICACIONES ADICIONALES DEL CLIENTE</Text>
            <Text>{String(dt.especificacionesAdicionales)}</Text>
          </>
        ) : null}

        {orden.notasTaller ? (
          <>
            <Text style={s.h2}>INDICACIONES PARA EL TALLER</Text>
            <Text>{orden.notasTaller}</Text>
          </>
        ) : null}

        <Text style={s.h2} break>DESPIECE PRESUPUESTADO — ES LO QUE SE FABRICA</Text>
        <Text style={{ marginBottom: 6, fontSize: 8, color: '#666' }}>
          Ante cualquier diferencia con el alcance solicitado, vale este despiece: es el que se
          presupuestó y el que se firmó en el contrato.
        </Text>
        <View style={[s.fila, { backgroundColor: '#E0E7F0' }]}>
          <Text style={[s.celda, { flex: 3.5, fontWeight: 'bold' }]}>Descripción</Text>
          <Text style={[s.celda, { flex: 0.8, fontWeight: 'bold' }]}>Unid.</Text>
          <Text style={[s.celda, { flex: 1.2, fontWeight: 'bold', textAlign: 'right' }]}>Cantidad</Text>
          <Text style={[s.celda, { flex: 1.2, fontWeight: 'bold', textAlign: 'right' }]}>Material</Text>
          {haySplitMo ? (
            <>
              <Text style={[s.celda, { flex: 1.2, fontWeight: 'bold', textAlign: 'right' }]}>MO fab.</Text>
              <Text style={[s.celda, { flex: 1.2, fontWeight: 'bold', textAlign: 'right' }]}>MO mont.</Text>
            </>
          ) : (
            <Text style={[s.celda, { flex: 1.2, fontWeight: 'bold', textAlign: 'right' }]}>Mano de obra</Text>
          )}
        </View>
        {[...porRubro.entries()].map(([rubro, filas]) => (
          <View key={rubro}>
            <View style={[s.fila, { backgroundColor: emisor.colorMarca }]}>
              <Text style={[s.celda, { flex: 1, color: 'white', fontWeight: 'bold' }]}>{rubro}</Text>
            </View>
            {filas.map((item, i) => (
              <View key={i} style={[s.fila, { backgroundColor: i % 2 === 0 ? 'white' : '#F8FAFB' }]}>
                <Text style={[s.celda, { flex: 3.5 }]}>{item.subrubro || item.descripcion}</Text>
                <Text style={[s.celda, { flex: 0.8 }]}>{item.unidad}</Text>
                <Text style={[s.celda, { flex: 1.2, textAlign: 'right' }]}>
                  {Number(item.cantidad || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </Text>
                <Text style={[s.celda, { flex: 1.2, textAlign: 'right' }]}>{usd(item.costoMaterialUsd)}</Text>
                {haySplitMo ? (
                  <>
                    <Text style={[s.celda, { flex: 1.2, textAlign: 'right' }]}>{usd(item.costoMoFabUsd)}</Text>
                    <Text style={[s.celda, { flex: 1.2, textAlign: 'right' }]}>{usd(item.costoMoMontajeUsd)}</Text>
                  </>
                ) : (
                  <Text style={[s.celda, { flex: 1.2, textAlign: 'right' }]}>{usd(item.costoMoUsd)}</Text>
                )}
              </View>
            ))}
          </View>
        ))}

        <View style={{ marginTop: 14, padding: 8, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }}>
          <Text style={{ fontSize: 7, color: '#9A3412' }}>
            DOCUMENTO INTERNO. Contiene costos de mano de obra: no se entrega al cliente.
            Emitida el {fecha(orden.createdAt)} a partir del presupuesto congelado en el contrato.
          </Text>
        </View>

        <Text
          style={{ position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7, color: '#999', textAlign: 'center' }}
          render={({ pageNumber, totalPages }) => `${orden.numero} · ${proyecto.codigo} · Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )

  return await renderToBuffer(doc)
}
