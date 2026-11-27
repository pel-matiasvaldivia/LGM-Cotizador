# Catálogos de proveedores — tabla técnica de aceros

`perfiles-acero.json` / `.csv` son la **referencia técnica** de los materiales
de acero: designación, dimensiones, espesor y kg por metro, tal como los
publican los proveedores. 784 registros entre perfiles conformados en frío,
tubos, perfiles laminados en caliente, barras para hormigón y planchuelas.

No son una lista de precios ni un maestro de artículos. Son la tabla contra la
que se convierte metros ↔ kilos y contra la que se valida el maestro del ERP.

## Para qué sirve

El maestro de artículos lleva el peso dentro del nombre —
`PERFIL C GALVANIZADO 140 X 60 X 20 X 3.2 (7.44 KG/M)` — y la estructura de
producto se despieza en kg. Si ese peso está mal cargado, el error se propaga
a la compra, al costo y al pedido al taller, sin que nada lo marque.

Con esta tabla:

- se valida cada artículo del ERP contra el catálogo del proveedor;
- se convierte el despiece paramétrico (metros de perfil) a kilos, que es la
  unidad en la que se compra y se stockea el acero;
- se puede sustituir un perfil por otro sabiendo cuánto cambia el peso.

## Regenerarlo

```bash
node scripts/catalogos/extraer-perfiles.mjs \
  --ternium <catálogo Ternium tubos y perfiles>.pdf \
  --acindar <catálogo Acindar tablas y equivalencias>.pdf
```

Necesita `pdftotext` (poppler-utils). Los PDF de origen no están en el repo
por tamaño: son los catálogos que entrega cada proveedor.

| Fuente | Tablas que se extraen |
| --- | --- |
| Ternium, *Tubos y perfiles* (versión 01, 2018) | Perfiles C y U conformados en frío (peso laminado y galvanizado); tubos redondos, cuadrados y rectangulares, de uso estructural y de uso general |
| Acindar, *Tablas y equivalencias* | Barras nervadas DN A 420 S y lisas AL 220; ángulos de alas iguales; UPN, IPN, IPB (HEB), IPBl (HEA), IPE y W; planchuelas lisas |

## Cruzar el maestro del ERP

```bash
node scripts/catalogos/cruzar-maestro.mjs \
  --maestro "./Listado de Artículos.csv" --salida ./desvios.csv
```

Lista los artículos cuyo peso declarado en el nombre no coincide con el del
proveedor, y arriesga la causa: el peso de otro espesor del mismo perfil, el
de otro perfil, la columna del laminado puesta en un galvanizado (o al revés),
o un redondeo del nombre. Lo que no encaja en ninguna queda marcado para
verificar contra el material.

Sobre el maestro de obra metálica de LOG METAL (474 artículos, noviembre 2026):
104 se pudieron cruzar, 88 coinciden y 16 no. Los dos desvíos gruesos son el
`140 X 60 X 20 X 3.2` cargado con el peso del `160` (+7,2 %) y el
`220 X 80 X 20 X 2.5` con el del mismo perfil en 3,2 mm (+27,4 %).

## Salvedades

- Los pesos son **nominales**. La norma admite tolerancia (±5 % en barras de
  10 mm o más, ±8 % en las más finas), así que el peso real de lo recibido no
  coincide al kilo.
- En los tubos de **uso general** la tabla del catálogo repite el espesor
  1,60 mm en dos columnas (laminado en frío y en caliente). Queda un solo
  registro por medida para ese espesor.
- El `kgM` de los perfiles C y U es el del laminado; `kgMGalvanizado` es el del
  mismo perfil galvanizado, ~1 % más pesado. **Para un artículo galvanizado hay
  que usar esa segunda columna.**
- Lo que no está en estos catálogos no está acá. El caso típico es el
  `TUBO REDONDO TUBING 2 7/8 (9.577 KG/M)`, que es tubería de pozo petrolero
  reutilizada y se rige por la norma API, no por el catálogo de Ternium.
