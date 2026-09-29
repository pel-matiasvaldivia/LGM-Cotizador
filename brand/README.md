# Assets de la marca del tenant

Esta carpeta se monta en el contenedor como `/app/public/brand` (ver
`docker-compose.yml`), así que todo lo que dejes acá queda servido bajo
`/brand/...` sin rebuildear la imagen.

Ejemplo: copiás `acero-sur.svg` en esta carpeta y en la config de marca ponés

```json
{ "logo": "/brand/acero-sur.svg" }
```

o directamente en `.env`:

```
BRAND_LOGO=/brand/acero-sur.svg
```

Formatos recomendados: SVG o PNG con fondo transparente. Para el logo del
footer (fondo oscuro) usá `logoOscuro` / `BRAND_LOGO_OSCURO` con la versión
en blanco.

El PDF del presupuesto sólo puede incrustar PNG o JPG: si el logo es SVG, el
encabezado del PDF cae al nombre de la empresa en texto.
