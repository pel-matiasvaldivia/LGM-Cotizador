# LGM Cotizador — Motor de Presupuestación

Cotizador de naves industriales de Log Metal SRL. Aplicación Next.js con Postgres,
autenticación propia y extracción de datos con IA (OpenAI).

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
