# LGM Cotizador — Motor de Presupuestación

Cotizador de naves industriales. Aplicación Next.js con Postgres, autenticación
propia y extracción de datos con IA (OpenAI). Se despliega como **marca blanca**:
la misma imagen sirve a cualquier empresa que contrate el servicio, con su logo,
su paleta y sus textos (ver [Marca blanca](#marca-blanca-white-label)).

## Arquitectura

- **`motor-presupuestacion/`** — app Next.js 16 (App Router, standalone output)
- **Postgres 16** — base de datos (contenedor propio, sin servicios externos)
- **Drizzle ORM** — esquema tipado en `src/db/schema.ts`, migraciones SQL en `drizzle/`
- **Auth propia** — sesiones en DB + cookie httpOnly (`src/lib/auth.ts`), roles `admin` / `comercial` / `cliente`
- **OpenAI** — transcripción de audios (Whisper) y extracción de variables (GPT-4o)

## Correr en producción

```bash
cp .env.example .env   # completar POSTGRES_PASSWORD, ADMIN_*, OPENAI_API_KEY
docker compose up -d
```

La app queda en el puerto **3300**. En el primer arranque el contenedor aplica las
migraciones, crea el usuario admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) y siembra un
catálogo de rubros/ratios de ejemplo (ajustarlos en `/configuracion/ratios`).

El servicio `backup` hace un `pg_dump` diario a `./backups/` (rotación 14 días).
Copiá esos dumps fuera del servidor.

## Marca blanca (white label)

Ningún nombre, logo ni color está escrito en el código de las páginas: toda la
identidad visible sale de una config de marca que se resuelve al arrancar el
contenedor. Alcanza (`docker compose up -d` de nuevo) para cambiar de marca.

**Qué es configurable:** logo (claro y sobre fondo oscuro), paleta, título y
descripción del sitio, textos del hero, tarjetas de servicios, sección
institucional con sus métricas, lista de clientes, datos de contacto y
WhatsApp, CTA final y pie. Los bloques sin datos (clientes, métricas, WhatsApp)
no se renderizan en vez de quedar vacíos. Sin logo cargado, se usa el nombre de
la empresa como wordmark tipográfico. La paleta también alcanza al panel
interno, al portal del cliente, a los mails automáticos y al PDF del R-04.

**Cómo se resuelve**, de menor a mayor prioridad:

1. marca neutra de base (en `src/lib/branding.ts`, no es la identidad de nadie)
2. `motor-presupuestacion/config/brands/<BRAND>.json` — preset versionado
3. `BRAND_CONFIG_FILE` — JSON externo, pensado para montar por volumen
4. variables `BRAND_*` — overrides puntuales

Los JSON son parciales: definen sólo lo que cambian y el merge es profundo (un
array, en cambio, se reemplaza entero). Ver `config/brands/ejemplo.json` para
una config completa comentada y `.env.example` para la lista de variables.

**Alta de un tenant nuevo** (opción mínima, sin tocar archivos del repo):

```bash
# en .env
BRAND_NOMBRE=Acero Sur
BRAND_RAZON_SOCIAL=Acero Sur S.A.
BRAND_COLOR_PRIMARY=#0e9f6e     # acento: botones, links, destacados
BRAND_COLOR_INK=#12263f         # institucional: títulos y secciones oscuras
BRAND_LOGO=/brand/acero-sur.svg # archivo dejado en ./brand/
BRAND_EMAIL=ventas@acerosur.example
BRAND_WHATSAPP=5492991234567
```

Con esos dos colores queda resuelta la paleta entera: los hovers, los fondos
suaves, los bordes y los tonos del pie se derivan por CSS (`color-mix`) desde
`primary` e `ink`, así que no hay que elegir diez variantes ni tocar Tailwind.

Para una identidad más completa (textos, servicios, métricas, clientes),
copiá `config/brands/ejemplo.json` a `config/brands/<tenant>.json` y poné
`BRAND=<tenant>`; o dejá el JSON fuera del repo y apuntale `BRAND_CONFIG_FILE`.

Los logos y las imágenes institucionales van en `./brand/`, que el compose monta
como `/app/public/brand` de sólo lectura: se referencian como `/brand/archivo.svg`
y no hace falta rebuildear la imagen (ver `brand/README.md`).

> El sitio de Log Metal es el preset `logmetal`. Si `BRAND` no está definida, la
> app arranca con la marca neutra: en el `.env` de ese despliegue tiene que estar
> `BRAND=logmetal`.

## Desarrollo

```bash
cd motor-presupuestacion
npm ci
# levantar un Postgres local y exportar DATABASE_URL, por ejemplo:
# DATABASE_URL=postgres://lgm:lgm@localhost:5432/cotizador
npm run db:migrate    # migraciones + seed inicial
npm run dev
```

Comandos útiles:

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | tests unitarios (Vitest) del motor de cálculo |
| `npm run db:generate` | genera una migración nueva desde `src/db/schema.ts` |
| `npm run db:migrate` | aplica migraciones y seed |

## CI

`.github/workflows/docker-image.yml` corre lint + typecheck + tests y después
buildea y publica la imagen en GHCR (`ghcr.io/pel-matiasvaldivia/lgm-cotizador`)
con tags por rama y por SHA.
