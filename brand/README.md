# Assets de marca (opcional)

**Lo normal es cargar el logo desde el panel**: Configuración → Empresa, en el
dominio de la empresa. Se guarda en la base y se sirve por `/api/brand/logo`, así
que funciona para varias empresas en el mismo contenedor y no necesita ni esta
carpeta ni un rebuild.

Esta carpeta sirve para el otro caso: dejar un logo **como valor inicial** del
despliegue, antes de que exista alguien que entre al panel. Se monta en el
contenedor como `/app/public/brand` (ver `docker-compose.yml`), así que lo que
dejes acá queda servido bajo `/brand/...`.

```
# en .env
BRAND_LOGO=/brand/acero-sur.svg
BRAND_LOGO_OSCURO=/brand/acero-sur-blanco.svg
```

Formatos recomendados: SVG o PNG con fondo transparente. Para el logo sobre
fondo oscuro (pie del sitio, panel) usá la versión en blanco.

El PDF del presupuesto sólo puede incrustar PNG o JPG: si el logo es SVG, el
encabezado del PDF cae al nombre de la empresa en texto.
