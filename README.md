# LGM Cotizador — Motor de Presupuestación

Cotizador de naves industriales. Aplicación Next.js con Postgres, autenticación
propia y extracción de datos con IA (OpenAI). Es **multi-tenant**: una sola
instancia atiende a varias empresas, cada una con su dominio, su identidad, sus
datos fiscales, sus usuarios y sus proyectos (ver
[Multi-tenant](#multi-tenant-una-instancia-varias-empresas)).

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

## Multi-tenant: una instancia, varias empresas

Cada empresa que contrata el servicio es un **tenant**, y se resuelve por el
**dominio** del request (`Host`, o `X-Forwarded-Host` detrás del proxy). De la
fila del tenant sale todo lo que el visitante ve y lo que el cliente recibe
impreso; nada de eso está escrito en el código de las páginas.

**Qué guarda cada empresa:** nombre y razón social, datos fiscales (CUIT,
condición frente al IVA, Ingresos Brutos, inicio de actividades), domicilio,
contacto y WhatsApp, logo (claro y para fondo oscuro), paleta, y los textos de
la landing (hero, servicios, métricas, clientes, cierre). Lo edita su propio
admin en **Configuración → Empresa**; los dominios no, porque son configuración
de plataforma.

**Dónde aparecen esos datos:** en la landing y el portal del cliente, en el
encabezado y el pie del presupuesto R-04 (razón social, CUIT, domicilio,
contacto arriba; condición de IVA, IIBB e inicio de actividades abajo), y en los
mails automáticos. Los bloques sin datos (clientes, métricas, WhatsApp) no se
renderizan en vez de quedar vacíos, y sin logo cargado se usa el nombre de la
empresa como wordmark tipográfico.

**Aislamiento.** Cada empresa tiene sus propios usuarios, proyectos, catálogo de
rubros/ratios, biblioteca de precios y parámetros de costeo. Una sesión sólo
vale en el dominio de su empresa (la cookie de un dominio no sirve en otro), y
un id de otra empresa responde 404, no 403. El mismo email —o el mismo código de
proyecto— puede existir en dos empresas sin chocar.

### Alta de una empresa

```bash
docker compose exec app node scripts/tenant.mjs crear acero-sur "Acero Sur" acerosur.com
docker compose exec app node scripts/tenant.mjs semilla acero-sur          # catálogo y parámetros
docker compose exec -e TENANT=acero-sur app node scripts/usuario.mjs admin@acerosur.com 'Clave_2026' admin
```

Después, ese admin entra por su dominio y completa CUIT, domicilio, logo y
colores desde **Configuración → Empresa**. Otros comandos:

```bash
node scripts/tenant.mjs listar                       # empresas, dominios, usuarios, proyectos
node scripts/tenant.mjs dominio acero-sur www2.acerosur.com
node scripts/tenant.mjs quitar-dominio viejo.com
node scripts/tenant.mjs desactivar acero-sur         # deja de responder en sus dominios
```

`semilla` copia el catálogo de la empresa más antigua como plantilla (o deja
sólo los parámetros por defecto si no hay de dónde copiar).

Un dominio que no está asignado a ninguna empresa no muestra la identidad de
nadie: responde una pantalla de "dominio no configurado".

### Colores: alcanzan dos

Con el color de acento y el institucional queda resuelta la paleta entera: los
hovers, fondos suaves, bordes y tonos del pie se derivan por CSS (`color-mix`),
así que no hay que elegir diez variantes ni tocar Tailwind. La paleta alcanza
también al panel interno, al portal del cliente, a los mails y al PDF.

### Config de archivo (arranque y despliegues de un solo cliente)

`config/brands/<BRAND>.json` + variables `BRAND_*` siguen existiendo, pero ya no
son la fuente de verdad: son los **valores iniciales**. En el primer arranque, el
bootstrap de `scripts/migrate.mjs` crea la empresa del despliegue con esos datos
(y le asigna los dominios de `TENANT_DOMINIOS`); de ahí en adelante manda la
base, y el bootstrap sólo completa los campos que siguen vacíos —nunca pisa lo
que se editó desde el panel. Ver `config/brands/ejemplo.json` para una config
completa y `.env.example` para la lista de variables.

Con una sola empresa en la base no hace falta configurar dominios: cualquier
Host resuelve a ella. `TENANT_DEFAULT=<slug>` fuerza una empresa concreta, útil
en desarrollo.

> La instalación de Log Metal migra sola: al aplicar la migración, los datos que
> ya existen quedan asignados a una empresa que adopta el slug de `BRAND`
> (`logmetal`), con sus textos y colores actuales copiados a la base.

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
