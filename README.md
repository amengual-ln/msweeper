# mines ∞

Buscaminas infinito, minimalista y pensado para el celular. Vue 3 + TypeScript + Canvas 2D. Sin backend, cuentas, analíticas ni servicios externos durante el juego.

## Desarrollo

Requiere Node.js 22.12+ (o 24 LTS) y npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Publicar en Vercel

1. Subir este proyecto a un repositorio de GitHub.
2. En Vercel, importar el repositorio como un proyecto nuevo.
3. Framework: **Vite**. Build: `npm run build`. Output: `dist`.
4. Deploy. No requiere variables de entorno. Los pushes posteriores a `main` pueden desplegarse automáticamente con la integración Git de Vercel.

La configuración está incluida en `vercel.json`. También se puede desplegar con `npx vercel --prod` desde una terminal autenticada.

## Controles

- Toque/clic: descubrir una casilla.
- Mantener pulsado, clic derecho o modo **Marcar**: alternar bandera.
- Arrastrar: explorar el tablero en cualquier dirección.
- Pellizcar, rueda o botones +/−: zoom.
- Mira: volver a la primera casilla descubierta.
- Tocar un número con suficientes banderas alrededor: descubrir los vecinos restantes. Las banderas incorrectas pueden provocar una derrota.
- Teclado con el tablero enfocado: flechas para seleccionar, Enter para descubrir, F para marcar, Home para regresar al origen, +/− para zoom.

## Motor

`src/engine.ts` contiene las reglas sin depender del navegador ni de Vue. Las minas se generan de forma determinista a partir de una semilla y las coordenadas (incluidas las negativas). El primer toque reserva un área segura de 3 × 3 antes de calcular números. Cada número cuenta los ocho vecinos, sin cortes entre regiones.

`src/board.ts` dibuja solamente las casillas visibles y controla punteros, cámara y zoom. El descubrimiento automático usa una cola iterativa con un máximo de 350 casillas procesadas por frame. El canvas solo se redibuja cuando cambia algo. El estado crece con las casillas descubiertas y las banderas, no con la distancia recorrida.

El objetivo es descubrir la mayor cantidad de casillas seguras. No hay pantalla de victoria en un tablero infinito. Densidad de minas: 17 %. No se garantiza que todas las situaciones sean resolubles sin adivinar.

## Alcance de esta versión

- La partida vive en memoria: recargar o cerrar la pestaña inicia una partida nueva.
- El mundo se genera bajo demanda. Como cualquier aplicación, la memoria disponible limita la cantidad de casillas que se pueden guardar durante una sesión extraordinariamente larga.
- Hay controles de teclado y anuncios accesibles, aunque Canvas no equivale a una grilla completa navegable por lectores de pantalla.
- Verificado: compilación de producción, pruebas automáticas del motor y gestos, revisión visual en navegador a 390 × 844 y escritorio. La emulación no reemplaza probar el tacto y el rendimiento en un teléfono real.

## Estructura

```text
src/engine.ts     Reglas y generación determinista
src/board.ts      Canvas, cámara y controles
src/App.vue       Interfaz y diálogos
src/style.css     Diseño responsive
tests/           Reglas e interacciones
```
