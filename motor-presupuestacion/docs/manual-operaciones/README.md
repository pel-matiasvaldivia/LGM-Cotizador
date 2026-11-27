# Manual de operaciones

El manual que se le entrega a cada empresa que usa la plataforma, en Word
(`.docx`) para que lo puedan editar, y con la marca de esa empresa: logo en la
portada y en el encabezado de cada página, y sus colores en los títulos.

El contenido vive **en un solo lugar**: `generar-manual.mjs`. No hay un Word
maestro que alguien edite a mano y después quede desincronizado — el documento
se vuelve a generar cuando cambia algo.

## Generarlo

```bash
# Con la base a mano (lo normal): logo, colores y datos salen del tenant
DATABASE_URL=postgres://... npm run manual -- --slug log-metal

# Sin base: alcanza con el nombre, el logo y el color
npm run manual -- --empresa "Acme Estructuras" --logo ./acme.png --color "#0B6E4F"

# Versión genérica, sin marca (para mostrar la plataforma)
npm run manual -- --empresa "Tu Empresa"
```

| Opción | Para qué |
| --- | --- |
| `--slug` | Empresa de la base. Trae nombre, razón social, CUIT, domicilio, contacto, logo y colores. Necesita `DATABASE_URL`. |
| `--empresa` | Nombre, cuando no se usa la base (o para pisar el de la base). |
| `--logo` | Archivo PNG o JPG. Sin logo se usa el nombre en texto. |
| `--color` / `--ink` | Color de acento y color institucional, en hexadecimal. |
| `--salida` | Dónde escribir el `.docx`. Por defecto, acá al lado. |

El `.docx` es editable: la empresa puede agregarle sus propias secciones,
cambiar textos o reemplazar el logo desde Word sin tocar nada del código.

## Qué contiene

Un recorrido completo de punta a punta, con capturas reales tomadas sobre el
proyecto de ejemplo `PROY-2026-2912` (nave Alveolar de 20 × 30 × 8 m, 600 m²,
con oficina interior y baño):

1. Qué es la plataforma
2. Puesta en marcha: los datos de la empresa (menú **Empresa**)
3. Cuentas y roles, y la confirmación del email del cliente
4. **Etapa A** · El cliente genera su cotización (`/cotizar`)
5. **Etapa B** · El cliente entra a su portal (`/mi-proyecto`)
6. **Etapa C** · El comercial analiza, modifica y envía (`/proyectos`)
7. **Etapa D** · El cliente ve el presupuesto y pre-aprueba
8. **Etapa E** · Cierre de la venta: contrato, firma y orden de producción
9. **Etapa F** · Producción: del despiece a la entrega en obra
10. Notificaciones automáticas por email
11. Mantenimiento del catálogo y los parámetros
12. Preguntas frecuentes
13. Datos de la empresa (se completan solos con `--slug`)

Los importes de las capturas son los que produjo el motor Base 0 con la
calibración de precios de ese día: son un ejemplo, no una lista de precios.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `generar-manual.mjs` | El generador. Acá se edita el texto del manual. |
| `img/` | Las capturas, numeradas por paso. |
| `Manual-Operaciones.docx` | El manual ya generado para LOG METAL, listo para enviar. |
| `Manual-Operaciones-LOGMETAL.pdf` | La versión vieja en PDF, no editable. Se conserva como referencia. |

### Actualizar las capturas

Si cambia una pantalla, se reemplaza el `.jpg` correspondiente en `img/`
manteniendo el nombre y se vuelve a generar. Los nombres los referencia el
generador uno por uno; si falta alguno, avisa por consola y sigue sin esa
imagen en vez de romper.
