# Edificio 5

Recorrido nocturno en primera persona por el Edificio 5 y sus alrededores. Puedes caminar por los pasillos, entrar en las aulas y los baños, y usar los interruptores y ventiladores. El proyecto usa TypeScript, Vite y Three.js.

## Ejecutar en local

Necesitas Node.js 22.12 o superior, pnpm 10.17.1 y un navegador con WebGL 2.

```sh
git clone https://github.com/crafael23/edif-5-wokwi-nodered.git
cd edif-5-wokwi-nodered
pnpm install --frozen-lockfile
pnpm dev
```

Abre la dirección que muestra Vite, normalmente `http://localhost:5173`. El [modelo `.glb`](src/assets/version-2-1.glb) ya viene incluido y permite ejecutar el recorrido sin SketchUp.

## Controles

| Acción | Control |
| --- | --- |
| Caminar | `W`, `A`, `S`, `D` o las flechas del teclado |
| Mirar alrededor | Haz clic en la escena y mueve el ratón. Pulsa `Esc` para soltarlo o arrastra la vista. |
| Girar con el teclado | `Q` y `E` |
| Usar un interruptor o regulador | Acércate, apunta al control y haz clic o pulsa `F`. |
| Ir al interior o al exterior | Usa los botones **Interior** y **Exterior**. |
| Volver al punto de inicio | Pulsa **Restart**. |
| Usar pantalla completa | Pulsa **Fullscreen** si el navegador muestra el botón. |

En una pantalla táctil, mantén pulsadas las flechas en pantalla para caminar, arrastra para mirar y toca los controles del edificio para usarlos.

Las luces de aulas y pasillos empiezan encendidas. Cada interruptor numerado del pasillo controla tres lámparas. Dentro de cada aula, junto a la puerta, el interruptor **LUZ** controla las seis lámparas y los reguladores **1** a **4** cambian la velocidad de cada ventilador.

## Compilar y probar

```sh
pnpm build
pnpm preview
```

`pnpm build` comprueba los tipos y genera el sitio estático en `dist/`. `pnpm preview` sirve esa compilación en local. Para comprobar solo los tipos, ejecuta `pnpm check`.
