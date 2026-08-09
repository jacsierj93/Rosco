# Rosco

Juego web inspirado en la dinámica del rosco, diseñado para jugarse en una TV y conducirse desde un teléfono móvil.

Consultar la [especificación funcional](docs/especificacion-funcional.md) y la [arquitectura técnica](docs/arquitectura-tecnica.md).

La carga y validación de palabras se documenta en [docs/contenido.md](docs/contenido.md).
El criterio propuesto para el cuarto nivel se documenta en [docs/nivel-infantil.md](docs/nivel-infantil.md).

## Decisiones principales

- Dos modos: teocrático y español general con preferencia configurable por lunfardo.
- Tres dificultades: fácil, intermedio y avanzado.
- Un rosco diferente por jugador, sin palabras repetidas dentro de una partida.
- Pantalla de TV dedicada a presentar el juego.
- Teléfono dedicado a configurar la partida y actuar como botonera.
- Sin base de datos en el MVP: el estado principal vive en la TV y el historial se conserva localmente.
- Sincronización en tiempo real con Node.js y Socket.IO.
- Despliegue inicial en Render.

## Probar con Podman

```bash
podman build -t rosco:dev .
podman run --rm --name rosco-dev \
  -p 3000:3000 \
  -e ROOM_SIGNING_SECRET=desarrollo-local-cambiar-esta-clave-123456 \
  rosco:dev
```

Abrir `http://localhost:3000/juego` en la pantalla principal. El QR generado conecta el teléfono si este puede acceder a la misma dirección; para probar con un teléfono físico se debe publicar la aplicación usando la IP local de la computadora en lugar de `localhost`.

## Desplegar en Render

El archivo [`render.yaml`](render.yaml) define un único servicio web en el plan gratuito. Render instala temporalmente las herramientas de compilación, compila el cliente y el servidor, elimina las dependencias exclusivas de desarrollo, genera `ROOM_SIGNING_SECRET` automáticamente y comprueba la ruta `/health` antes de publicar una versión. Este flujo no ejecuta pruebas ni validaciones editoriales.

1. Subir este repositorio a GitHub o GitLab.
2. En el panel de Render, elegir **New > Blueprint**.
3. Conectar el repositorio y confirmar la creación del servicio `rosco`.
4. Esperar a que el health check quede en verde y abrir la URL `https://<servicio>.onrender.com/juego` en la TV.
5. Escanear el QR con un teléfono y completar una partida de prueba.

Cada commit en la rama vinculada inicia un despliegue automático. No es necesario configurar `PORT`: Render lo proporciona en tiempo de ejecución. No se debe reemplazar ni exponer `ROOM_SIGNING_SECRET`; cambiarlo invalida las credenciales de recuperación de las salas abiertas.

El estado de las partidas y el historial viven en el almacenamiento local de la TV. Un reinicio o despliegue del servidor corta las salas en curso, pero no borra ese estado; al volver a cargar, la TV intenta recuperar la partida.

## Pruebas

Los controles rápidos de tipos y dominio se ejecutan con:

```bash
npm run check
```

La suite E2E abre una pantalla de TV y un control móvil en Chromium. La primera vez requiere instalar el navegador administrado por Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

Para ejecutar validación editorial, pruebas unitarias, E2E y build de producción en una sola pasada:

```bash
npm run check:all
```
