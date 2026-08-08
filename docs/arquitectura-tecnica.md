# Arquitectura técnica — Rosco

Estado: propuesta 0.1  
Basada en la especificación funcional 1.0

## 1. Stack

- Cliente: React, TypeScript y Vite.
- Servidor: Node.js, TypeScript, Express y Socket.IO.
- Validación de datos: Zod en los límites de red, configuración y contenido.
- Pruebas unitarias: Vitest.
- Pruebas de interfaz y flujo: Playwright.
- Despliegue: un Web Service gratuito de Render.
- Persistencia del MVP: `localStorage` en la pantalla de TV.

React se usa para las dos interfaces, pero la lógica de dominio se mantiene en funciones y reductores TypeScript independientes de la vista.

## 2. Estructura prevista

```text
Rosco/
├── client/
│   ├── src/
│   │   ├── app/
│   │   ├── juego/
│   │   ├── control/
│   │   ├── componentes/
│   │   └── estilos/
│   └── index.html
├── server/
│   └── src/
│       ├── salas/
│       ├── seguridad/
│       └── index.ts
├── shared/
│   ├── dominio/
│   ├── protocolo/
│   ├── contenido/
│   └── validacion/
├── content/
│   ├── teocratico/
│   └── general/
├── tests/
│   ├── unit/
│   └── e2e/
└── docs/
```

Un solo `package.json` en la raíz administrará los scripts del MVP. Se evitarán workspaces hasta que exista una necesidad real de publicar paquetes por separado.

## 3. Rutas

- `/`: presentación y elección de pantalla.
- `/juego`: interfaz de TV y creación/recuperación de sala.
- `/control/:sala`: configuración y botonera móvil.
- `/health`: estado básico del servidor para Render.

Express servirá el resultado compilado por Vite y manejará Socket.IO sobre el mismo servidor HTTP.

## 4. Autoridad del estado

La TV es la única autoridad sobre:

- Configuración confirmada.
- Asignación de preguntas.
- Estado de cada letra.
- Jugador y pregunta actuales.
- Temporizadores.
- Puntuación.
- Historial de uso.
- Secuencia de acciones.

El teléfono nunca modifica directamente el estado. Envía una intención; la TV la valida, aplica y devuelve una vista actualizada.

```text
Teléfono -- intención --> Servidor -- retransmisión --> TV
Teléfono <-- vista ----- Servidor <-- publicación ---- TV
```

El servidor conoce conexiones, roles, tokens y caducidad, pero no calcula resultados.

## 5. Máquina de estados

El dominio se implementará como un reductor puro:

```ts
reducirPartida(estadoActual, accion, ahora) => nuevoEstado
```

Acciones principales:

- `CONFIGURACION_CONFIRMADA`
- `PARTIDA_PREPARADA`
- `TURNO_INICIADO`
- `OPCION_SELECCIONADA` (un error detiene el reloj y cierra el turno tras la revelación)
- `RESPUESTA_NO_LISTADA`
- `PASAPALABRA`
- `PAUSA_EMERGENCIA`
- `TURNO_REANUDADO`
- `TIEMPO_AGOTADO`
- `REVISION_RESUELTA`
- `PARTIDA_FINALIZADA`

Cada acción sensible incluye `actionId`, `roomId`, `sequence` y marca temporal. Una acción con secuencia vieja, repetida o no permitida por el estado actual se rechaza sin efectos.

## 6. Temporizador

No se persistirá un contador que decrece cada segundo. El estado guardará:

- Milisegundos restantes al iniciar.
- Instante monotónico de comienzo del tramo activo.
- Acumulación consumida.
- Estado activo o detenido.

La interfaz calcula la presentación del reloj localmente. Al responder o pausar, la TV calcula el tiempo efectivo usando `performance.now()` durante la sesión. Para recuperación tras recarga se guarda además una referencia basada en `Date.now()`.

La TV emite sincronizaciones periódicas al teléfono, pero el teléfono nunca se considera fuente confiable del tiempo.

## 7. Protocolo Socket.IO

### Cliente hacia servidor

- `room:create`
- `room:join-control`
- `room:resume-display`
- `control:intent`
- `display:state`
- `display:heartbeat`

### Servidor hacia cliente

- `room:created`
- `room:joined`
- `room:peer-status`
- `control:intent`
- `display:state`
- `protocol:error`

El servidor valida tamaño, forma, rol y frecuencia de todo mensaje antes de retransmitirlo.

## 8. Vistas de estado

La TV no envía el estado completo al teléfono. Construye una vista limitada:

```ts
type ControlView = {
  roomId: string;
  phase: string;
  sequence: number;
  connected: boolean;
  currentPlayer?: { id: string; name: string; remainingMs: number };
  letter?: string;
  options?: Array<{ id: string; label: string }>;
  canStart: boolean;
  canPass: boolean;
  canEmergencyPause: boolean;
};
```

La vista no incluye la pista, el identificador de la opción correcta, el banco ni preguntas futuras.

## 9. Salas

Una sala en memoria contiene:

- Código público corto.
- Hash del token de control.
- Socket de TV.
- Socket de control.
- Fecha de creación y última actividad.
- Credencial firmada de recuperación de la TV.

Política inicial:

- Código de seis caracteres sin símbolos ambiguos.
- Token aleatorio de al menos 128 bits.
- Credencial de recuperación firmada con un secreto de entorno del servidor.
- Caducidad tras dos horas sin actividad.
- Un control y una TV por sala.
- Límite de intentos por IP y sala.
- Los tokens completos no se escriben en logs.

Las salas desaparecen si el proceso de Render reinicia. La TV puede demostrar su rol mediante la credencial firmada, recrear la sesión y emitir un QR nuevo; la partida sigue en su almacenamiento local. La clave de firma reside en una variable segura de Render y no cambia entre despliegues.

## 10. Persistencia local

Se usarán claves versionadas:

- `rosco.settings.v1`
- `rosco.history.v1`
- `rosco.activeGame.v1`
- `rosco.displayCredential.v1`

Los datos se validan al leerlos. Si una migración o validación falla, se conserva una copia exportable y la aplicación ofrece comenzar sin restauración.

El estado activo se guarda después de cada transición, no en cada actualización visual del reloj.

## 11. Generador de roscos

El generador será determinista a partir de una semilla registrada. Esto permite reproducir errores y reconstruir una asignación.

Fases:

1. Filtrar contenido válido por modo y dificultad.
2. Crear candidatos por letra y relación.
3. Aplicar exclusión de la partida y enfriamiento.
4. Asignar respuestas a todos los jugadores con retroceso si una letra queda sin candidatos.
5. Ajustar el peso regional global.
6. Asignar distractores no usados como respuestas en la partida.
7. Validar cobertura completa.

La generación es atómica: produce todos los roscos o devuelve un error explicable, sin resultados parciales.

## 12. Contenido

Los bancos se versionan con la aplicación como JSON estático validado durante el build. No se extrae contenido de sitios externos durante una partida.

Cada entrada tendrá:

- Identificador estable.
- Respuesta y variantes.
- Letra y relación.
- Modos y categorías.
- Dificultad de palabra.
- Pistas disponibles por nivel.
- Fuente y URL.
- Marcas editoriales opcionales.

Un script de validación generará un informe de cobertura por modo, nivel y letra. El build falla ante errores estructurales; una cobertura insuficiente deshabilita explícitamente la combinación afectada.

## 13. Render

Proceso de producción:

1. Instalar dependencias.
2. Validar contenido.
3. Ejecutar pruebas y compilar cliente y servidor.
4. Iniciar el servidor Node sobre `process.env.PORT`.

El servicio expondrá `/health`. Los clientes implementarán reconexión con espera exponencial. Mientras Render despierta, la interfaz mostrará un estado de preparación sin perder configuración local.

## 14. Seguridad y privacidad

- HTTPS y WebSocket seguro en producción.
- CSP y encabezados de seguridad desde Express.
- Esquemas estrictos para eventos de red.
- Límites de carga y frecuencia.
- Escape de nombres de jugadores y cualquier texto importado.
- Sin secretos administrativos dentro del bundle del cliente.
- Sin analítica ni rastreo en el MVP.
- Eliminación de salas inactivas y datos exclusivamente temporales en el servidor.

## 15. Estrategia de pruebas

### Unitarias

- Generación sin repeticiones.
- Enfriamiento y selección ponderada.
- Transiciones válidas e inválidas.
- Cálculo de tiempo.
- Clasificación y revisiones.
- Reconstrucción desde persistencia.
- Filtrado de la vista del control.

### Integración

- Crear y vincular sala.
- Rechazar token o rol incorrecto.
- Retransmitir intención y estado.
- Reconectar teléfono.
- Recuperar TV.

### E2E

- Configurar dos jugadores y completar una partida.
- Pasar y retomar una palabra.
- Agotar tiempo.
- Pausar por desconexión.
- Resolver una respuesta dudosa.
- Mostrar clasificación final correcta.

## 16. Orden de implementación

1. Tipos, esquemas y reductor de dominio.
2. Contenido mínimo artificial y validador.
3. Generador de roscos y pruebas unitarias.
4. Servidor de salas y protocolo.
5. Flujo de vinculación.
6. Configuración móvil.
7. Pantalla de TV.
8. Botonera y ciclo completo de turnos.
9. Persistencia y recuperación.
10. Revisión, resultados y accesibilidad.
11. Bancos editoriales reales.
12. Pruebas E2E y despliegue en Render.
