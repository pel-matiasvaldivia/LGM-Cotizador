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
- **Auth propia** — sesiones en DB + cookie httpOnly (`src/lib/auth.ts`), roles `admin` / `comercial` / `cliente` por empresa, más la marca `superadmin` para administrar la plataforma
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

### Actualizar el servidor

La imagen la publica el CI en cada push, con un tag por rama: **`main` es lo
liberado**. Para traer la última versión:

```bash
git pull                    # el compose tiene que apuntar a :main
docker compose pull app
docker compose up -d app
docker compose logs -f app  # las migraciones corren solas en el arranque
```

> Si el `docker-compose.yml` del servidor todavía dice `:master`, el servidor se
> queda clavado en esa rama vieja y **ningún cambio nuevo llega**, por más que
> estén mergeados en `main`. Es el primer lugar donde mirar cuando algo que ya
> está en el repo no se ve en el sitio: `docker compose images app` muestra qué
> imagen está corriendo de verdad.

Las migraciones son parte del arranque (`docker-entrypoint.sh`), así que un
`pull` + `up -d` alcanza: no hay un paso manual de migración.

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

### Panel de plataforma

**Plataforma** (en el menú del panel, sólo visible para superadmins) es donde se
administran las empresas del servicio: la pantalla lista cada una con sus
dominios y métricas (usuarios, proyectos, rubros), y permite dar de alta,
asignar y mover dominios, sembrar el catálogo, crear el primer admin,
desactivar y borrar.

El **alta guiada** hace los cuatro pasos de una vez: crea la empresa, le asigna
los dominios, le copia un catálogo de arranque con los parámetros de costeo, y
le crea su admin. Después ese admin entra por su dominio y completa CUIT,
domicilio, logo y colores desde **Configuración → Empresa**.

**Quién administra la plataforma.** Es una marca aparte (`usuarios.superadmin`),
ortogonal al `rol` dentro de cada empresa: un superadmin sigue siendo admin o
comercial de la empresa por la que entra, y no pierde nada de lo suyo. El admin
maestro del despliegue (`ADMIN_EMAIL`) queda marcado en el arranque. Para el
admin de una empresa, la administración de la plataforma no existe: responde
404, no "sin permisos".

```bash
# otorgar o revocar el rol de plataforma
docker compose exec -e TENANT=logmetal app node scripts/tenant.mjs superadmin alguien@empresa.com
docker compose exec -e TENANT=logmetal app node scripts/tenant.mjs superadmin alguien@empresa.com --quitar
```

**Desactivar** una empresa deja sus dominios sin resolver (queda la pantalla de
"dominio no configurado") sin borrar nada: es la forma de cortar el servicio y
poder reactivarlo. **Borrar** se lleva usuarios, proyectos, catálogo, precios y
configuración de esa empresa, y por eso exige repetir su identificador; nadie
puede borrar la empresa por la que está entrando.

Un dominio se mueve de una empresa a otra asignándolo: el panel avisa de dónde
salía, porque el cambio redirige un sitio en producción.

### Las mismas operaciones por consola

`scripts/tenant.mjs` hace lo mismo sin pasar por el panel — es la vía de rescate
cuando el panel no está disponible o todavía no hay ningún superadmin. La semilla
de una empresa (parámetros de costeo + copia del catálogo) es **el mismo código**
en los dos caminos: vive en `scripts/lib/semilla.mjs`, que la app empaqueta en el
build y los scripts importan directo, porque en la imagen standalone `src/` no
existe.

```bash
docker compose exec app node scripts/tenant.mjs listar
docker compose exec app node scripts/tenant.mjs crear acero-sur "Acero Sur" acerosur.com
docker compose exec app node scripts/tenant.mjs semilla acero-sur
docker compose exec -e TENANT=acero-sur app node scripts/usuario.mjs admin@acerosur.com 'Clave_2026' admin
docker compose exec app node scripts/tenant.mjs dominio acero-sur www2.acerosur.com
docker compose exec app node scripts/tenant.mjs quitar-dominio viejo.com
docker compose exec app node scripts/tenant.mjs desactivar acero-sur
```

`semilla` copia el catálogo de la empresa más antigua como plantilla (o deja
sólo los parámetros por defecto si no hay de dónde copiar), y es idempotente: si
la empresa ya tiene catálogo propio, no lo toca.

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
