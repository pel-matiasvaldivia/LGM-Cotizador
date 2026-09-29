import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer'
import type { EmisorPDF } from '@/lib/pdf-emisor'

// El presupuesto lo firma una empresa concreta (multi-tenant): sus datos y su
// paleta llegan por `emisor`, no se leen de ninguna config global. Los estilos
// se arman por documento porque los colores cambian según la empresa.
function crearEstilos(emisor: EmisorPDF) {
  return StyleSheet.create({
    page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    title: { fontSize: 14, fontWeight: 'bold', color: emisor.colorMarca },
    emisorLinea: { fontSize: 7, color: '#666', marginTop: 1 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    tableCell: { padding: 5, flex: 1 },
    totalRow: { backgroundColor: emisor.colorAcento, color: 'white', flexDirection: 'row', padding: 8 },
  })
}

export async function generarR04PDF(presupuesto: any, items: any[], emisor: EmisorPDF) {
  const styles = crearEstilos(emisor)
  const MARCA = emisor.colorMarca
  const ACENTO = emisor.colorAcento
  // Agrupar items por rubro
  const porRubro = items.reduce((acc, item) => {
    const rubro = item.rubro_nombre || item.rubro?.nombre || 'Otros'
    if (!acc[rubro]) acc[rubro] = []
    acc[rubro].push(item)
    return acc
  }, {} as Record<string, any[]>)

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ maxWidth: 300 }}>
            {emisor.logo
              ? <Image src={emisor.logo} style={{ width: 130, height: 'auto' }} />
              : <Text style={styles.title}>{emisor.razonSocial}</Text>
            }
            {/* Datos del emisor: los que el cliente necesita para aceptar la
                oferta y para su contabilidad. */}
            {emisor.logo ? <Text style={{ fontSize: 9, fontWeight: 'bold', color: MARCA, marginTop: 4 }}>{emisor.razonSocial}</Text> : null}
            {emisor.cuit ? <Text style={styles.emisorLinea}>CUIT: {emisor.cuit}</Text> : null}
            {emisor.domicilio ? <Text style={styles.emisorLinea}>{emisor.domicilio}</Text> : null}
            {[emisor.telefono, emisor.email, emisor.web].filter(Boolean).length > 0 ? (
              <Text style={styles.emisorLinea}>
                {[emisor.telefono, emisor.email, emisor.web].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <Text style={{ fontSize: 8, color: '#888', marginTop: 4 }}>PRESUPUESTO — R-04</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: MARCA }}>
              Presupuesto N° {presupuesto.codigo || '—'}
            </Text>
            <Text style={{ fontSize: 8, color: '#888', marginTop: 2 }}>Formulario R-04 | Rev. 01</Text>
            <Text style={{ fontSize: 8, color: '#888' }}>
              Fecha: {(presupuesto.fecha ? new Date(presupuesto.fecha) : new Date()).toLocaleDateString('es-AR')}
            </Text>
          </View>
        </View>

        {/* Datos del proyecto */}
        <View style={{ marginBottom: 16, padding: 8, backgroundColor: '#F8F9FA' }}>
          <Text>N° PRESUPUESTO: {presupuesto.codigo || '—'}</Text>
          {presupuesto.razon_social ? <Text>CLIENTE: {presupuesto.razon_social}</Text> : null}
          <Text>OBRA: {presupuesto.cliente || presupuesto.proyecto?.cliente || ''}</Text>
          <Text>UBICACIÓN: {presupuesto.ubicacion || presupuesto.proyecto?.ubicacion || ''}</Text>
          <Text>TIPOLOGÍA: {presupuesto.tipologia || ''}</Text>
          <Text>SUPERFICIE: {Number(presupuesto.superficie_m2 || 0).toLocaleString('en-US')} m²</Text>
          <Text>TN ESTRUCTURA: {Number(presupuesto.tn_estructura || 0).toFixed(2)} tn</Text>
        </View>

        {/* Cabecera de columnas */}
        <View style={[styles.tableRow, { backgroundColor: '#E0E7F0' }]}>
          <Text style={[styles.tableCell, { flex: 3, fontWeight: 'bold' }]}>Descripción</Text>
          <Text style={[styles.tableCell, { flex: 0.8, fontWeight: 'bold' }]}>Unid.</Text>
          <Text style={[styles.tableCell, { flex: 1.2, fontWeight: 'bold' }]}>Cantidad</Text>
          <Text style={[styles.tableCell, { flex: 1.5, fontWeight: 'bold' }]}>P. Unit. u$d</Text>
          <Text style={[styles.tableCell, { flex: 1.5, fontWeight: 'bold' }]}>Subtotal u$d</Text>
        </View>

        {/* Items agrupados por rubro */}
        {Object.entries(porRubro).map(([rubro, rubItems]: [string, any]) => {
          const subtotal = rubItems.reduce((a: number, i: any) => a + Number(i.precio_venta_usd || 0), 0)
          return (
            <View key={rubro} style={{ marginBottom: 8 }}>
              <View style={[styles.tableRow, { backgroundColor: MARCA }]}>
                <Text style={[styles.tableCell, { flex: 6, color: 'white', fontWeight: 'bold' }]}>{rubro}</Text>
                <Text style={[styles.tableCell, { flex: 1.5, color: 'white', fontWeight: 'bold' }]}>
                  u$d {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              {rubItems.map((item: any, i: number) => (
                <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? 'white' : '#F8FAFB' }]}>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{item.subrubro_nombre || item.descripcion}</Text>
                  <Text style={[styles.tableCell, { flex: 0.8 }]}>{item.unidad}</Text>
                  <Text style={[styles.tableCell, { flex: 1.2 }]}>{Number(item.cantidad || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>
                    u$d {(Number(item.precio_venta_usd || 0) / Math.max(Number(item.cantidad || 1), 1)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>
                    u$d {Number(item.precio_venta_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>
          )
        })}

        {/* Totales */}
        <View style={[styles.totalRow, { marginTop: 15 }]}>
          <Text style={{ flex: 1 }}>TOTAL VENTA (SIN IVA)</Text>
          <Text>u$d {Number(presupuesto.total_venta_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={{ flexDirection: 'row', padding: 6, backgroundColor: '#FAFAFA' }}>
          <Text style={{ flex: 1 }}>IVA {((presupuesto.iva_pct ?? 0.21) * 100).toFixed(0)}%</Text>
          <Text>u$d {Number(presupuesto.iva_usd ?? Number(presupuesto.total_venta_usd || 0) * 0.21).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={[styles.totalRow, { backgroundColor: MARCA }]}>
          <Text style={{ flex: 1 }}>TOTAL CON IVA</Text>
          <Text>u$d {Number(presupuesto.total_con_iva_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        {/* Indicador de precio por m² (venta). El costo por m² es interno y no
            se muestra al cliente. */}
        {presupuesto.precio_m2_usd ? (
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            <View style={{ flex: 1, padding: 8, backgroundColor: '#F8F9FA', borderRadius: 4 }}>
              <Text style={{ fontSize: 7, color: '#888' }}>PRECIO POR m²</Text>
              <Text style={{ fontSize: 12, color: ACENTO, fontWeight: 'bold' }}>u$d {Number(presupuesto.precio_m2_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        ) : null}

        {/* Condiciones comerciales */}
        <View style={{ marginTop: 20, fontSize: 8 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>CONDICIONES COMERCIALES</Text>
          <Text>Tipo de cambio: Dólar Oficial BNA — ${presupuesto.tipo_cambio_usd || '–'}</Text>
          <Text>Forma de pago: {presupuesto.condiciones_pago || '30% Anticipo - 70% Avance'}</Text>
          <Text>Validez de oferta: {presupuesto.validez_oferta_dias || 15} días corridos</Text>
          <Text>Plazo de obra: según contrato</Text>
        </View>

        {/* Pie fiscal del emisor */}
        {[emisor.condicionIva, emisor.ingresosBrutos, emisor.inicioActividades].filter(Boolean).length > 0 ? (
          <View style={{ marginTop: 14, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
            <Text style={{ fontSize: 7, color: '#888' }}>
              {[
                emisor.condicionIva && `Condición frente al IVA: ${emisor.condicionIva}`,
                emisor.ingresosBrutos && `Ingresos Brutos: ${emisor.ingresosBrutos}`,
                emisor.inicioActividades && `Inicio de actividades: ${emisor.inicioActividades}`,
              ].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  )

  return await renderToBuffer(doc)
}
