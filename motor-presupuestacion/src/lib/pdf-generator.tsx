import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#1B2A47' },
  table: { display: 'flex', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tableHeader: { backgroundColor: '#1B2A47', color: 'white', padding: 6, fontWeight: 'bold' },
  tableCell: { padding: 5, flex: 1 },
  totalRow: { backgroundColor: '#F05A28', color: 'white', flexDirection: 'row', padding: 8 },
})

export async function generarR04PDF(presupuesto: any, items: any[]) {
  // Agrupar items por rubro
  const porRubro = items.reduce((acc, item) => {
    const rubro = item.descripcion_rubro || item.rubro?.nombre || 'Otros'
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
            <Text style={styles.title}>LOG METAL SRL</Text>
            <Text>PRESUPUESTO — R-04</Text>
          </View>
          <View>
            <Text>Código: R-04 | Rev. 01</Text>
            <Text>Fecha: {new Date().toLocaleDateString('es-AR')}</Text>
          </View>
        </View>

        {/* Datos del proyecto */}
        <View style={{ marginBottom: 16 }}>
          <Text>OBRA: {presupuesto.proyecto?.cliente || ''}</Text>
          <Text>UBICACIÓN: {presupuesto.proyecto?.ubicacion || ''}</Text>
          <Text>SUPERFICIE: {presupuesto.superficie_m2 || 0} m²</Text>
          <Text>TN ESTRUCTURA: {presupuesto.tn_estructura || 0} kg</Text>
        </View>

        {/* Tabla de ítems por rubro */}
        {Object.entries(porRubro).map(([rubro, rubItems]: [string, any]) => (
          <View key={rubro} style={{ marginBottom: 12 }}>
            <View style={[styles.tableRow, { backgroundColor: '#1B2A47' }]}>
              <Text style={[styles.tableCell, { color: 'white', fontWeight: 'bold' }]}>{rubro}</Text>
            </View>
            {rubItems.map((item: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{item.descripcion}</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>{item.unidad}</Text>
                <Text style={[styles.tableCell, { flex: 1.2 }]}>{Number(item.cantidad || 0).toLocaleString('en-US',{minimumFractionDigits:2})}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>u$d {(Number(item.precio_venta_usd || 0)/Number(item.cantidad || 1)).toLocaleString('en-US',{minimumFractionDigits:2})}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>u$d {Number(item.precio_venta_usd || 0).toLocaleString('en-US',{minimumFractionDigits:2})}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Totales */}
        <View style={[styles.totalRow, { marginTop: 15 }]}>
          <Text style={{ flex: 1 }}>TOTAL VENTA (SIN IVA)</Text>
          <Text>u$d {Number(presupuesto.total_venta_usd || 0).toLocaleString('en-US',{minimumFractionDigits:2})}</Text>
        </View>
        <View style={{ flexDirection: 'row', padding: 6 }}>
          <Text style={{ flex: 1 }}>IVA 21%</Text>
          <Text>u$d {(Number(presupuesto.total_venta_usd || 0) * 0.21).toLocaleString('en-US',{minimumFractionDigits:2})}</Text>
        </View>
        <View style={[styles.totalRow, { backgroundColor: '#1B2A47' }]}>
          <Text style={{ flex: 1 }}>TOTAL CON IVA</Text>
          <Text>u$d {Number(presupuesto.total_con_iva_usd || 0).toLocaleString('en-US',{minimumFractionDigits:2})}</Text>
        </View>

        {/* Condiciones comerciales */}
        <View style={{ marginTop: 20, fontSize: 8 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>CONDICIONES COMERCIALES</Text>
          <Text>Tipo de cambio: Dólar Oficial BNA — ${presupuesto.tipo_cambio_usd}</Text>
          <Text>Forma de pago: {presupuesto.condiciones_pago || ''}</Text>
          <Text>Validez de oferta: {presupuesto.validez_oferta_dias || 15} días corridos</Text>
          <Text>Plazo de obra: según contrato</Text>
        </View>
      </Page>
    </Document>
  )

  return await renderToBuffer(doc)
}
