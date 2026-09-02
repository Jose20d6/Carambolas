# Carambolas — Materiales de costura y calculadora de costos

Aplicación web para gestionar los materiales de costura y calcular el costo
de cada producto según los materiales que usa.

## Funcionalidad

- **Materiales**: al cargar un material se ingresan dos valores — el
  **costo de compra** y **cuánto trae** (cantidad) — y la app calcula
  automáticamente el **valor unitario** (costo de compra ÷ cantidad). Ambos
  valores se guardan y se pueden editar en cualquier momento.
- **Actualización automática desde el proveedor**: cada material puede
  configurarse con la URL de la página del proveedor y un selector CSS que
  ubique el precio (y opcionalmente la cantidad) en esa página. El botón
  "Actualizar precio" (o "Actualizar todos los precios") vuelve a leer la
  página y recalcula el valor unitario. Como cada sitio de proveedor
  muestra el precio de forma distinta, hace falta indicar el selector CSS
  una sola vez por material — se obtiene inspeccionando el elemento del
  precio en el navegador (clic derecho → Inspeccionar) y copiando su clase,
  id, o atributo (p. ej. `.precio`, `#price`, `[itemprop=price]`).
- **Calculadora de productos**: al armar un producto, se eligen materiales
  de una lista desplegable **ordenada alfabéticamente** y se indica la
  cantidad usada de cada uno; la app suma el costo total del producto en
  base al valor unitario de cada material.

## Requisitos

- Node.js 22.5 o superior (usa `fetch` y el módulo `node:sqlite`, ambos nativos).
  No hace falta compilar nada ni instalar Python/Visual Studio Build Tools:
  todas las dependencias son JavaScript puro.

## Instalación y uso

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:3000`.

Para desarrollo con reinicio automático:

```bash
npm run dev
```

## Datos

Los datos se guardan en una base SQLite local (`data/costura.db`), que se
crea automáticamente al iniciar el servidor por primera vez. Ese archivo no
se versiona en git (ver `.gitignore`).

## Estructura

```
server/            Backend Express + SQLite
  db.js            Esquema de la base de datos
  scraper.js        Descarga y extrae valores de la página del proveedor
  priceParser.js    Interpreta texto de precio a número
  routes/
    materials.js    API de materiales
    products.js     API de productos y sus materiales
public/            Frontend estático (HTML/CSS/JS sin build)
  index.html
  css/style.css
  js/api.js         Cliente de la API
  js/materials.js   Alta/edición/listado de materiales
  js/calculator.js  Calculadora de costo por producto
  js/app.js         Navegación entre pestañas
```
