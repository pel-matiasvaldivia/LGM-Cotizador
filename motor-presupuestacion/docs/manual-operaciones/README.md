# Manual de operaciones — Cotizador LOG METAL

Recorrido completo de una cotización de punta a punta, con capturas reales de la
plataforma tomadas ejecutando el flujo sobre el proyecto de ejemplo
**`PROY-2026-2912`** (nave Alveolar de 20 × 30 × 8 m, 600 m², con oficina interior
y baño).

Etapas:

- **A.** El cliente genera su cotización (canal Web).
- **B.** El cliente entra a su portal.
- **C.** El comercial analiza, modifica, descarga y envía.
- **D.** El cliente ve el presupuesto actualizado.

> Los importes (costo interno, precio de venta, IVA y total) son los que produce
> el motor de cálculo Base 0 con la calibración de precios vigente.

---

## A · El cliente genera su cotización

Canal Web · pantalla pública `/cotizar`. Un asistente guiado de 7 pasos: el
cliente arma su nave y ve un precio orientativo en vivo. Al finalizar, el sistema
crea el proyecto y calcula automáticamente el presupuesto Base 0.

### 01 · Inicio del cotizador
El cliente entra a la pantalla pública y presiona **Comenzar Cotización**. No
necesita cuenta todavía.

![Inicio del cotizador](img/01-cotizar-bienvenida.jpg)

### 02 · Tipo de estructura
Elige el sistema estructural de la nave: Alveolar, Alma Llena o Reticulada. La
selección avanza sola al siguiente paso.

![Tipo de estructura](img/02-cotizar-tipologia.jpg)

### 03 · Dimensiones y ubicación
Carga ancho, largo, altura libre y la localidad de la obra. En el ejemplo: una
nave de 20 × 30 × 8 m (600 m²) en Mendoza.

![Dimensiones y ubicación](img/04-cotizar-dimensiones.jpg)

### 04 · Tipo de cubierta
Selecciona el material del techo (Chapa Trapezoidal o Panel Sándwich).

![Tipo de cubierta](img/05-cotizar-cubierta.jpg)

### 05 · Alcance del proyecto
El paso clave: el cliente activa lo que necesita. Acá encendió **Oficina interior**
(5 × 6 m), **Baño interior** e **Instalación eléctrica**. Cada opción incorpora sus
rubros (tabiques, revestimientos, obra civil, sanitaria…) y el **precio estimado se
actualiza en vivo** arriba a la derecha (USD 144.187).

![Alcance del proyecto](img/07-cotizar-alcance-completo.jpg)

### 06 · Planos (opcional)
Puede subir un plano o boceto para que la IA extraiga más detalles. Es opcional:
en el ejemplo se omite.

![Planos opcionales](img/08-cotizar-planos.jpg)

### 07 · Datos de contacto
Completa nombre, empresa, DNI, email y teléfono. Un resumen del proyecto y el
precio estimado quedan a la vista antes de confirmar.

![Datos de contacto](img/09-cotizar-contacto.jpg)

### 08 · Crea su cuenta del portal
Con el mismo email define una contraseña. Estas son las credenciales con las que
después entrará a seguir su proyecto.

![Crear cuenta](img/10-cotizar-crear-cuenta.jpg)

### 09 · Consulta registrada
Al confirmar, el sistema crea el proyecto (código `PROY-2026-2912`) y ejecuta el
cálculo del presupuesto Base 0. El cliente ve la confirmación.

![Consulta registrada](img/11-cotizar-gracias.jpg)

---

## B · El cliente entra a su portal

Portal del cliente · `/mi-proyecto`. Con las credenciales recién creadas, el
cliente accede para seguir el estado del proyecto en tiempo real.

### 10 · Estado: Recibido
El portal muestra el código del proyecto, una línea de tiempo (Recibido →
Presupuesto → Preaprobado → Aprobado) y el detalle técnico de la solicitud.
Todavía **no hay precio visible**: el presupuesto aún no fue enviado por el equipo
comercial.

![Portal cliente - Recibido](img/12-cliente-portal-recibido.jpg)

---

## C · El comercial analiza, modifica, descarga y envía

Portal comercial · `/proyectos`. El comercial recibe el proyecto, revisa el
costeo interno, ajusta lo que haga falta, descarga el presupuesto y lo envía.

### 11 · Ingreso al portal comercial
El comercial inicia sesión con sus credenciales en `/login`.

![Login comercial](img/14-comercial-login-lleno.jpg)

### 12 · Lista de proyectos
Ve el proyecto nuevo generado desde el canal Web, en estado **Borrador**, y lo
abre.

![Lista de proyectos](img/15-comercial-lista-proyectos.jpg)

### 13 · Análisis — Presupuesto Base 0 (interno)
La pestaña **Presupuesto Base 0** muestra el costo real de la empresa: cada rubro
y subrubro con material, mano de obra e incidencia, más la cascada de costeo
(indirectos → beneficio → IVA) y el **costo y precio por m²**. Esta vista es
interna y no se comparte con el cliente.

![Detalle Base 0](img/16-comercial-detalle-base0.jpg)

### 14 · Modificación — agregar un ítem
Si el comercial necesita sumar algo que no vino en el Base 0, presiona **Agregar
ítem**.

![Modal agregar ítem](img/17-comercial-modal-agregar-item.jpg)

### 15 · Biblioteca de precios
Busca el ítem en la biblioteca de precios de referencia (Revista Cifras) o lo
carga a medida.

![Buscar en la biblioteca](img/18-comercial-buscar-item.jpg)

### 16 · Presupuesto recalculado
Al agregar el ítem, el presupuesto se recalcula solo: los totales, la incidencia y
el precio por m² se actualizan al instante.

![Ítem agregado y recalculado](img/19-comercial-item-agregado.jpg)

### 17 · Vista previa del presupuesto al cliente
La pestaña **Presupuesto Cliente** muestra el R-04 tal como lo verá el cliente:
rubros y subrubros con precio de venta, subtotal, IVA y total. **No se expone el
costo interno ni el costo por m².**

![Vista cliente](img/20-comercial-vista-cliente.jpg)

### 18 · Descarga del PDF R-04
Con **Descargar R-04** obtiene el PDF del presupuesto, con el encabezado
identificado (*Presupuesto N° PROY-2026-2912*) y el detalle por rubro y subrubro.

![PDF R-04](img/24-pdf-r04-pagina1.jpg)

### 19 · Envío al cliente
Al presionar **Enviar presupuesto al cliente**, el estado del proyecto pasa a
**Enviado** y aparece la confirmación “Presupuesto enviado al cliente”. Esto
habilita la vista del presupuesto en el portal del cliente.

![Presupuesto enviado](img/21-comercial-enviado.jpg)

---

## D · El cliente ve el presupuesto actualizado

Portal del cliente · `/mi-proyecto`. El cliente vuelve a entrar y ahora encuentra
el presupuesto disponible, con el precio y la descarga del PDF.

### 20 · Presupuesto disponible
La línea de tiempo avanzó a **Presupuesto** y aparece la tarjeta **Tu
presupuesto**: subtotal sin IVA, precio por m² y total con IVA (USD 174.480), más
el botón **Descargar PDF**. Los valores coinciden exactamente con los del
comercial.

![Portal cliente - Presupuesto](img/23-cliente-portal-presupuesto.jpg)
