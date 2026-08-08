# Especificación funcional — Rosco

Estado: especificación funcional 1.0  
Fecha: 3 de agosto de 2026

## 1. Objetivo

Crear un juego web de rosco para varios jugadores, presentado en una TV y conducido desde un teléfono. La TV comunica las preguntas y el estado público; el teléfono configura la partida y funciona exclusivamente como botonera durante el juego.

La aplicación tendrá un servidor mínimo para vincular dispositivos. Las preguntas, los temporizadores, las reglas, la puntuación y el estado autoritativo de la partida permanecerán en el navegador de la TV.

## 2. Modos de contenido

### 2.1. Rosco teocrático

- Basado editorialmente en el [Glosario de la Traducción del Nuevo Mundo](https://wol.jw.org/es/wol/publication/r4/lp-s/nwtstg/0).
- Las pistas serán adaptadas para el juego y conservarán un enlace a la fuente.
- Podrán incluir referencias bíblicas como metadatos o ayudas futuras.
- Se admiten relaciones `empieza` y `contiene`.

### 2.2. Rosco general

- Vocabulario general en español, con fuentes editoriales acreditadas.
- Las palabras podrán etiquetarse como `general`, `argentinismo` y `lunfardo`.
- La preferencia regional controla el peso de selección:
  - Sin preferencia: 0 %.
  - Toque rioplatense: 20 %.
  - Rioplatense: 30 % (valor inicial).
  - Mucho lunfardo: 50 %.
- El porcentaje es un objetivo de selección, no una garantía por letra. Nunca debe impedir generar un rosco válido.

## 3. Dificultad

| Propiedad | Niños | Fácil | Intermedio | Avanzado |
|---|---|---|---|---|
| Frecuencia de términos | Infantil y cotidiana | Alta | Media | Baja o especializada |
| Redacción de pista | Concreta y breve | Directa | Descriptiva | Indirecta o contextual |
| Relación `contiene` | Solo cuando sea natural | 0–10 % | 15–25 % | 30–40 % |
| Tiempo sugerido | 180 s | 150 s | 120 s | 90 s |
| Ayudas en el MVP | No | No | No | No |

El tiempo es configurable independientemente de la dificultad. Una entrada puede ofrecer pistas distintas por nivel o estar disponible solo en determinados niveles. `Niños` usa un banco editorial propio por pista; nunca reutiliza automáticamente la pista de nivel fácil.

### 3.1. Valores de partida del MVP

- El rosco usa 25 letras: `A, B, C, D, E, F, G, H, I, J, L, M, N, Ñ, O, P, Q, R, S, T, U, V, X, Y, Z`.
- Se excluyen `K` y `W` por su baja disponibilidad en español.
- La cantidad de letras no es configurable en el MVP.
- Se admiten entre 1 y 4 jugadores.
- El tiempo se configura para toda la partida y se aplica por igual a cada jugador.
- Valores sugeridos: 150, 120 y 90 segundos según la dificultad; el conductor puede modificarlos.
- La dificultad es común a todos los jugadores de una partida.

## 4. Roles e interfaces

### 4.1. Pantalla de TV

Responsabilidades:

- Crear una sala y mostrar el QR y código de vinculación.
- Recibir y conservar la configuración completa.
- Generar los roscos antes de la partida.
- Mantener el estado autoritativo y los temporizadores.
- Mostrar jugador, letra, relación, pista, rosco, tiempo y puntaje.
- Ocultar inmediatamente la pregunta cuando no hay un turno activo.
- Mostrar resultados y revisión pública al terminar.
- Guardar una copia de recuperación en `localStorage`.
- Leer opcionalmente la relación y la pista mediante la voz española disponible en el dispositivo.

La TV no muestra las opciones de validación durante el turno; estas pertenecen exclusivamente a la botonera.

### 4.2. Teléfono del conductor

Antes de la partida permite configurar:

- Modo de rosco.
- Nivel de dificultad.
- Cantidad y nombres de jugadores.
- Tiempo individual.
- Preferencia de lunfardo para el modo general.
- Orden de participación.

Durante la partida funciona exclusivamente como botonera. Puede mostrar el nombre del jugador, la letra activa, el estado de conexión y el tiempo como confirmación, pero no muestra la pista.

Controles del turno:

- Cuatro o cinco opciones de respuesta, sin señalar la correcta.
- `No aparece` para registrar una respuesta dudosa.
- `Pasapalabra`.
- Pausa de emergencia mediante pulsación prolongada.
- Repetir la pregunta cuando la lectura en voz alta está activada.

La configuración permite activar por separado la lectura de pistas y los efectos de confirmación, ambos reproducidos en la TV. La TV conserva localmente la voz española elegida. La lectura se cancela al responder, pasar, pausar o abandonar la partida y usa un ritmo más lento en el nivel `Niños`.

Fuera de un turno activo:

- `Iniciar turno`.
- Acceso a revisión, recuperación y desvinculación.

## 5. Vinculación de dispositivos

1. La TV abre `/juego` y solicita crear una sala.
2. El servidor devuelve un identificador corto y un token de control de alta entropía.
3. La TV muestra un QR hacia `/control/:sala?token=...` y el código manual.
4. El teléfono se vincula y la TV confirma visualmente la conexión.
5. El teléfono envía la configuración completa.
6. La TV valida, genera los roscos y muestra un resumen.
7. El teléfono confirma el comienzo.

Reglas de seguridad:

- El código de sala por sí solo no autoriza acciones de control.
- Las salas caducan por inactividad.
- Solo puede existir un control principal en el MVP.
- La TV puede revocar el control y emitir un token nuevo.
- El servidor limita intentos de vinculación y tamaño/frecuencia de mensajes.

## 6. Preparación de la partida

Cada jugador recibe un rosco diferente. Todos se generan de forma completa antes de comenzar.

Prioridades del selector:

1. Cumplir letra, relación, modo y dificultad.
2. No repetir palabras entre jugadores de la misma partida.
3. Respetar, hasta donde sea posible, el peso regional configurado.
4. Excluir palabras dentro del período de enfriamiento.
5. Priorizar palabras nunca utilizadas.
6. Priorizar las utilizadas hace más partidas.
7. Priorizar las de menor cantidad total de usos.

Si no existen suficientes entradas, la partida no comienza. La app debe explicar la restricción y ofrecer reducir jugadores o letras, ampliar dificultad o flexibilizar el período de enfriamiento.

## 7. Turnos y temporizadores

- Solo un jugador puede tener el reloj activo.
- El reloj no comienza automáticamente al cambiar de jugador.
- La TV mantiene oculta la pregunta hasta recibir `Iniciar turno`.
- `Iniciar turno` muestra la pregunta y las opciones de la botonera de forma coordinada, y luego inicia el reloj.
- Una respuesta correcta avanza a la siguiente pregunta sin detener el reloj.
- Una respuesta incorrecta detiene el reloj, revela la solución y cierra el turno.
- `Pasapalabra` detiene el reloj, conserva la letra pendiente, oculta la pregunta y prepara al siguiente jugador.
- Una pausa de emergencia detiene el reloj y oculta pregunta y letra activa.
- Una desconexión del control durante un turno produce una pausa automática.
- Si el tiempo llega a cero, se oculta la pregunta y se cierra la participación del jugador.

Un turno termina por:

- Pasapalabra.
- Tiempo agotado.
- Rosco completado.
- Pausa de emergencia, hasta su posterior reanudación.

## 8. Evaluación de respuestas

El jugador responde oralmente mirando la TV. El conductor pulsa en el teléfono la opción que corresponda con lo escuchado.

### 8.1. Opción correcta

- La letra queda `correcta`.
- La TV la marca en verde.
- Se presenta la siguiente pregunta sin detener el reloj.

### 8.2. Opción incorrecta

- La letra queda `incorrecta` y no vuelve a aparecer.
- La TV la marca en rojo.
- La respuesta correcta se muestra durante un intervalo breve, inicialmente 2 segundos.
- El reloj se detiene antes de la revelación.
- Al finalizar la revelación se prepara el siguiente jugador disponible. Con un solo jugador se prepara un nuevo turno del mismo jugador.

El intervalo de revelación **no consume tiempo**.

### 8.3. Pasapalabra

- La letra continúa `pendiente`.
- No se revela la respuesta.
- El reloj se detiene inmediatamente.
- La pregunta y las opciones desaparecen.
- El jugador volverá a esa letra en una ronda posterior.

### 8.4. No aparece

- Registra la letra como `en_revision`.
- Guarda el instante, jugador, pregunta y opciones disponibles.
- Avanza sin detener el reloj.
- La decisión se resuelve antes de cerrar los resultados.

En la TV, `en_revision` usa un estado neutral diferenciado de correcta, incorrecta y pendiente. Cuenta provisionalmente como no acertada hasta que el conductor la resuelva.

Al resolver una revisión, el resultado puede convertirse en correcto o incorrecto y recalcula la clasificación.

## 9. Opciones de la botonera

Cada pregunta tendrá una respuesta correcta y cuatro distractores en orden aleatorio.

Los distractores deben:

- Cumplir la misma relación con la letra.
- Pertenecer al mismo modo.
- Tener dificultad semejante.
- Ser términos reales del banco.
- No ser respuestas asignadas a otro jugador en la misma partida.
- Evitar opciones obviamente absurdas cuando existan alternativas.

Las variantes aceptadas se asocian a la opción principal; no ocupan botones separados.

## 10. Rondas

- El orden inicial es el configurado en el teléfono.
- Al finalizar un turno se elige el siguiente jugador que conserve tiempo y letras pendientes.
- Los jugadores sin tiempo o con rosco completo son omitidos.
- Al regresar a un jugador se retoma la primera letra pendiente según el orden circular de su rosco.
- Si queda un solo jugador activo, cada `Pasapalabra` cierra su turno y requiere una nueva pulsación de `Iniciar turno`; no se reinicia automáticamente.

## 11. Final y clasificación

La partida termina cuando todos los jugadores completaron su rosco o agotaron su tiempo. Antes de publicar el resultado final deben resolverse las respuestas `en_revision`.

Criterios de clasificación:

1. Mayor cantidad de respuestas correctas.
2. Menor cantidad de respuestas incorrectas.
3. Mayor tiempo restante.
4. Empate formal si los valores anteriores coinciden.

El resultado incluye por jugador:

- Correctas, incorrectas y no respondidas.
- Tiempo restante.
- Detalle por letra.
- Palabras y fuentes, visibles después de cerrar la partida.

## 12. Historial y repetición

El historial se guarda en el dispositivo de la TV, que es la autoridad de la partida, y contiene, por entrada:

- Identificador estable.
- Última partida en que apareció.
- Cantidad total de usos.

El período de enfriamiento inicial será de cinco partidas. La configuración y el historial podrán exportarse e importarse como JSON para cambiar de dispositivo o crear una copia de seguridad.

El historial se actualiza solo cuando una partida comienza efectivamente, evitando penalizar palabras de configuraciones canceladas.

No se sincroniza una segunda copia en el teléfono durante el MVP. Esto evita conflictos entre historiales de dispositivos diferentes.

## 13. Estado funcional

Estados principales de una sala:

```text
creando_sala
  -> esperando_control
  -> configurando
  -> preparando
  -> lista
  -> turno_activo
  -> entre_turnos
  -> pausada
  -> revisando
  -> finalizada
```

Transiciones sensibles como responder, pasar, pausar y comenzar turno llevan un número de secuencia. La TV ignora mensajes repetidos o fuera de orden para impedir dobles pulsaciones.

## 14. Sincronización y recuperación

- Node.js, Express y Socket.IO retransmiten mensajes entre los dos clientes.
- El servidor mantiene únicamente salas y conexiones temporales.
- La TV es la autoridad del estado de juego.
- Después de cada acción, la TV envía al teléfono una vista reducida del estado.
- Si el servidor reinicia, ambos clientes se reconectan; la TV vuelve a registrar la sala y publica el estado vigente.
- Si el teléfono se recarga, recibe nuevamente su vista de control.
- Si la TV se recarga, intenta restaurar la partida desde `localStorage` y exige confirmación antes de continuar.

## 15. Requisitos no funcionales del MVP

- Diseño de TV legible a distancia y adaptable a 16:9.
- Botonera operable con una mano y objetivos táctiles amplios.
- Contraste suficiente; el estado no depende exclusivamente del color.
- Respuesta visual inmediata a cada pulsación.
- Protección contra doble toque.
- Funcionamiento en versiones actuales de Chrome, Edge y Safari móvil.
- HTTPS en producción.
- Sin cuentas de usuario ni datos personales más allá de nombres introducidos para una partida.

## 16. Fuera del MVP

- Reconocimiento automático de voz.
- Aplicaciones móviles nativas.
- Cuentas y perfiles.
- Historial sincronizado en la nube.
- Edición colaborativa del banco.
- Controles simultáneos.
- Partidas competitivas desde ubicaciones distintas.
- Estadísticas históricas avanzadas.
- Ayudas o pistas adicionales durante un turno.

## 17. Modelo preliminar de contenido

```json
{
  "id": "teocratico-mana",
  "respuesta": "maná",
  "variantesAceptadas": ["el maná"],
  "letra": "M",
  "relacion": "empieza",
  "modos": ["teocratico"],
  "categorias": ["glosario-biblico"],
  "dificultadPalabra": 1,
  "pistas": {
    "facil": "Alimento que Dios proporcionó a los israelitas en el desierto.",
    "intermedio": "Sustancia que los israelitas recogían durante seis días.",
    "avanzado": "Su nombre se relaciona con la pregunta que hicieron al verla."
  },
  "fuente": {
    "nombre": "Biblioteca en línea Watchtower",
    "url": "https://wol.jw.org/"
  }
}
```

## 18. Requisitos del banco para el lanzamiento

Cada modo debe tener suficiente cobertura para cuatro roscos simultáneos y opciones plausibles:

- Como mínimo, 28 candidatos compatibles por cada letra y nivel habilitado.
- Esa reserva cubre cuatro respuestas, cuatro distractores y seis partidas consecutivas sin repetir respuestas.
- Ninguna entrada puede depender de una única variante ambigua para validarse.
- Cada pista y sus opciones deben pasar una revisión editorial manual.
- La validación automática previa al despliegue debe detectar identificadores duplicados, letras incorrectas, pistas ausentes, fuentes inválidas y cobertura insuficiente.

No se fija un total global porque la cobertura por letra es más importante que el tamaño absoluto. Un modo o nivel permanece deshabilitado si no puede garantizar la rotación sostenible para la cantidad máxima de jugadores anunciada.

## 19. Decisiones cerradas para el MVP

- Rosco fijo de 25 letras, sin `K` ni `W`.
- Entre uno y cuatro jugadores.
- Revelación de dos segundos después de un error, con el reloj detenido y cambio de turno.
- Respuestas dudosas en estado visual neutral hasta su revisión.
- Historial autoritativo en la TV, con exportación e importación manual.
- Sin ayudas durante el turno en el MVP.
- Lanzamiento condicionado por cobertura por letra y nivel, no por un número total arbitrario de palabras.
