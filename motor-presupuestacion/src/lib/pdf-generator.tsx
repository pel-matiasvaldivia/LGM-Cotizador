import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer'
import path from 'path'
import fs from 'fs'

// Read logo as base64 from public folder at render time
const logoPath = path.join(process.cwd(), 'public', 'logo.png')
const logoBase64 = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
  : null

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#1B2A47' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tableCell: { padding: 5, flex: 1 },
  totalRow: { backgroundColor: '#F05A28', color: 'white', flexDirection: 'row', padding: 8 },
})

export async function generarR04PDF(presupuesto: any, items: any[]) {
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
          <View>
            {logoBase64
              ? <Image src={logoBase64} style={{ width: 130, height: 'auto' }} />
              : <Text style={styles.title}>LOG METAL SRL</Text>
            }
            <Text style={{ fontSize: 8, color: '#888', marginTop: 2 }}>PRESUPUESTO — R-04</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text>Código: R-04 | Rev. 01</Text>
            <Text>Fecha: {new Date().toLocaleDateString('es-AR')}</Text>
          </View>
        </View>

        {/* Datos del proyecto */}
        <View style={{ marginBottom: 16, padding: 8, backgroundColor: '#F8F9FA' }}>
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
              <View style={[styles.tableRow, { backgroundColor: '#1B2A47' }]}>
                <Text style={[styles.tableCell, { flex: 6, color: 'white', fontWeight: 'bold' }]}>{rubro}</Text>
                <Text style={[styles.tableCell, { flex: 1.5, color: 'white', fontWeight: 'bold' }]}>
                  u$d {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              {rubItems.map((item: any, i: number) => (
                <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? 'white' : '#F8FAFB' }]}>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{item.descripcion}</Text>
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
          <Text style={{ flex: 1 }}>IVA 21%</Text>
          <Text>u$d {(Number(presupuesto.total_venta_usd || 0) * 0.21).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={[styles.totalRow, { backgroundColor: '#1B2A47' }]}>
          <Text style={{ flex: 1 }}>TOTAL CON IVA</Text>
          <Text>u$d {Number(presupuesto.total_con_iva_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        {/* Condiciones comerciales */}
        <View style={{ marginTop: 20, fontSize: 8 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>CONDICIONES COMERCIALES</Text>
          <Text>Tipo de cambio: Dólar Oficial BNA — ${presupuesto.tipo_cambio_usd || '–'}</Text>
          <Text>Forma de pago: {presupuesto.condiciones_pago || '30% Anticipo - 70% Avance'}</Text>
          <Text>Validez de oferta: {presupuesto.validez_oferta_dias || 15} días corridos</Text>
          <Text>Plazo de obra: según contrato</Text>
        </View>
      </Page>
    </Document>
  )

  return await renderToBuffer(doc)
}
