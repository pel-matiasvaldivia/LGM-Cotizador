import { describe, expect, it } from 'vitest'
import { esSector, etapaDerivada, normalizarSectores, requireSector, type EstadoCircuito } from './produccion'
import type { Despacho, MaterialOrden, OrdenCompra, ParteFabricacion, Usuario } from '@/db/schema'

function usuario(patch: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    tenantId: 't1',
    email: 'quien@empresa.com',
    passwordHash: '',
    nombre: 'Quien Sea',
    rol: 'comercial',
    sectores: [],
    superadmin: false,
    emailVerificadoAt: null,
    verificacionTokenHash: null,
    verificacionExpira: null,
    createdAt: new Date(),
    ...patch,
  } as Usuario
}

function material(patch: Partial<MaterialOrden> = {}): MaterialOrden {
  return {
    id: 'm1',
    tenantId: 't1',
    ordenId: 'o1',
    proyectoId: 'p1',
    subconjunto: 'Columnas',
    codigo: '9',
    descripcion: 'PERFIL W 250X17,9',
    unidad: 'kg',
    cantidadRequerida: 100,
    cantidadDisponible: 0,
    cantidadRecibida: 0,
    estado: 'pendiente',
    origen: 'flexxus',
    nota: '',
    orden: 0,
    createdAt: new Date(),
    ...patch,
  } as MaterialOrden
}

function parte(patch: Partial<ParteFabricacion> = {}): ParteFabricacion {
  return {
    id: 'f1',
    tenantId: 't1',
    ordenId: 'o1',
    proyectoId: 'p1',
    nombre: 'Columnas',
    cantidad: 1,
    unidad: 'un',
    estado: 'pendiente',
    cantidadDespachada: 0,
    responsable: '',
    notas: '',
    orden: 0,
    iniciadaAt: null,
    terminadaAt: null,
    createdAt: new Date(),
    ...patch,
  } as ParteFabricacion
}

type OcConItems = EstadoCircuito['ordenesCompra'][number]
function oc(items: Array<{ materialId: string; cantidad: number; cantidadRecibida?: number }>, patch: Partial<OrdenCompra> = {}): OcConItems {
  return {
    id: 'oc1',
    numero: 'OC-2026-9394-1',
    estado: 'pedida',
    items: items.map((i) => ({ cantidadRecibida: 0, ...i })),
    ...patch,
  } as OcConItems
}

type DespachoConItems = EstadoCircuito['despachos'][number]
function despacho(patch: Partial<Despacho> = {}): DespachoConItems {
  return {
    id: 'd1',
    numero: 'REM-2026-9394-1',
    estado: 'preparado',
    items: [{ cantidad: 1, cantidadRecibida: 0, parteId: 'f1' }],
    ...patch,
  } as DespachoConItems
}

function circuito(patch: Partial<EstadoCircuito> = {}): EstadoCircuito {
  return { materiales: [], ordenesCompra: [], partes: [], despachos: [], ...patch }
}

describe('etapaDerivada', () => {
  it('arranca esperando el despiece', () => {
    expect(etapaDerivada(circuito())).toBe('materiales')
  })

  it('pasa a verificación en cuanto hay materiales sin revisar', () => {
    expect(etapaDerivada(circuito({ materiales: [material()] }))).toBe('verificacion')
  })

  it('manda a compras si quedó un faltante sin pedir', () => {
    const estado = circuito({
      materiales: [material({ estado: 'faltante', cantidadDisponible: 40 })],
    })
    expect(etapaDerivada(estado)).toBe('compras')
  })

  it('pasa a recepción cuando el faltante ya está pedido', () => {
    const estado = circuito({
      materiales: [material({ id: 'm1', estado: 'pedido', cantidadDisponible: 40 })],
      ordenesCompra: [oc([{ materialId: 'm1', cantidad: 60 }])],
    })
    expect(etapaDerivada(estado)).toBe('recepcion')
  })

  it('vuelve a compras si la OC pedida no cubre todo lo que falta', () => {
    const estado = circuito({
      materiales: [material({ id: 'm1', estado: 'pedido', cantidadDisponible: 40 })],
      ordenesCompra: [oc([{ materialId: 'm1', cantidad: 25 }])],
    })
    expect(etapaDerivada(estado)).toBe('compras')
  })

  it('no cuenta lo pedido en una OC anulada', () => {
    const estado = circuito({
      materiales: [material({ id: 'm1', estado: 'pedido', cantidadDisponible: 40 })],
      ordenesCompra: [oc([{ materialId: 'm1', cantidad: 60 }], { estado: 'anulada' })],
    })
    expect(etapaDerivada(estado)).toBe('compras')
  })

  it('habilita fabricación recién con todo el material resuelto', () => {
    const estado = circuito({
      materiales: [
        material({ id: 'm1', estado: 'disponible', cantidadDisponible: 100 }),
        material({ id: 'm2', estado: 'recibido', cantidadDisponible: 40, cantidadRecibida: 60 }),
      ],
    })
    expect(etapaDerivada(estado)).toBe('fabricacion')
  })

  it('sigue en fabricación mientras quede una parte sin terminar', () => {
    const estado = circuito({
      materiales: [material({ estado: 'disponible', cantidadDisponible: 100 })],
      partes: [parte({ id: 'f1', estado: 'terminada' }), parte({ id: 'f2', estado: 'en_proceso' })],
    })
    expect(etapaDerivada(estado)).toBe('fabricacion')
  })

  it('pasa a despacho con todo terminado y nada enviado', () => {
    const estado = circuito({
      materiales: [material({ estado: 'disponible', cantidadDisponible: 100 })],
      partes: [parte({ estado: 'terminada' })],
    })
    expect(etapaDerivada(estado)).toBe('despacho')
  })

  it('espera el control en obra cuando ya salió todo', () => {
    const estado = circuito({
      materiales: [material({ estado: 'disponible', cantidadDisponible: 100 })],
      partes: [parte({ estado: 'terminada', cantidadDespachada: 1 })],
      despachos: [despacho({ estado: 'en_transito' })],
    })
    expect(etapaDerivada(estado)).toBe('obra')
  })

  it('no se cierra sola: la cierra oficina técnica', () => {
    const estado = circuito({
      materiales: [material({ estado: 'disponible', cantidadDisponible: 100 })],
      partes: [parte({ estado: 'terminada', cantidadDespachada: 1 })],
      despachos: [despacho({ estado: 'entregado' })],
    })
    expect(etapaDerivada(estado)).toBe('obra')
    expect(etapaDerivada(estado, true)).toBe('cerrada')
  })

  it('un remito rechazado deja la obra abierta', () => {
    const estado = circuito({
      materiales: [material({ estado: 'disponible', cantidadDisponible: 100 })],
      partes: [parte({ estado: 'terminada', cantidadDespachada: 1 })],
      despachos: [despacho({ estado: 'rechazado' })],
    })
    expect(etapaDerivada(estado, true)).toBe('obra')
  })

  it('retrocede si aparece material nuevo sin verificar', () => {
    const estado = circuito({
      materiales: [
        material({ id: 'm1', estado: 'disponible', cantidadDisponible: 100 }),
        material({ id: 'm2', estado: 'pendiente' }),
      ],
      partes: [parte({ estado: 'terminada' })],
    })
    expect(etapaDerivada(estado)).toBe('verificacion')
  })
})

describe('permisos por sector', () => {
  it('el admin entra a todos los sectores', () => {
    const u = usuario({ rol: 'admin' })
    expect(esSector(u, 'taller')).toBe(true)
    expect(() => requireSector(u, 'logistica')).not.toThrow()
  })

  it('cada uno hace lo suyo', () => {
    const u = usuario({ sectores: ['abastecimiento'] })
    expect(() => requireSector(u, 'abastecimiento')).not.toThrow()
    expect(() => requireSector(u, 'taller')).toThrow(/Taller/)
  })

  it('el cliente no interviene en el circuito', () => {
    expect(() => requireSector(usuario({ rol: 'cliente', sectores: ['taller'] }), 'taller')).toThrow(/Sin permisos/)
  })

  it('descarta sectores inventados y repetidos', () => {
    expect(normalizarSectores(['taller', 'taller', 'rrhh', 42])).toEqual(['taller'])
    expect(normalizarSectores('taller')).toEqual([])
  })
})
