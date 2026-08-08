# Flujo editorial de contenido

Los bancos reales viven en:

- `content/general.json`
- `content/teocratico.json`

La aplicación usa dos bancos editoriales reales. El banco general contiene 735 entradas y el teocrático 794; ambos conservan al menos 28 opciones compatibles por cada una de las 25 letras y pistas suficientes para los cuatro niveles. Los dos modos sostienen seis partidas consecutivas para cuatro jugadores sin repetir respuestas.

## Validar respuestas candidatas

Antes de redactar las tres pistas de cada término se puede fijar y revisar el vocabulario en un CSV reducido. El lote general ya cerrado está en `content/sources/general-candidates-remaining.csv`. Los 200 candidatos teocráticos están distribuidos en `content/sources/teocratico-candidates-01.csv` a `content/sources/teocratico-candidates-04.csv`.

```bash
npm run content:candidates
```

Para validar el primer lote teocrático (ocho candidatos por letra de A a E):

```bash
npm run content:candidates -- \
  --input content/sources/teocratico-candidates-01.csv \
  --existing content/teocratico.json \
  --letters A,B,C,D,E
```

El control exige ocho candidatos por cada letra del lote, verifica la relación `empieza`/`contiene`, URLs HTTPS y categorías. También informa cuántos ya fueron promovidos al banco indicado, cuántos quedan por redactar y la proporción regional o lunfarda.

La fuente primaria teocrática es el Glosario de la Traducción del Nuevo Mundo. Para las letras con cobertura insuficiente en su índice (especialmente Ñ, Q y X), se usan artículos específicos de `Perspicacia para comprender las Escrituras`, también publicados en JW.ORG; esas filas llevan la categoría `perspicacia-biblica`. Como cada entrada tiene una pista propia para los tres niveles, `wordDifficulty` queda en 1: la dificultad efectiva la determina la pista elegida, no la exclusión del término en niveles inferiores.

## Importar un CSV

Copiar `content/templates/palabras.csv` y completar una fila por término. Los campos que admiten varios valores usan `|` como separador.

```bash
npm run content:import -- \
  --input mi-banco.csv \
  --output content/general.json
```

La importación es atómica: si alguna fila tiene errores no modifica el archivo de salida.

Para agregar un lote validándolo junto con el contenido existente:

```bash
npm run content:import -- \
  --input nuevo-lote.csv \
  --output content/general.json \
  --append
```

## Campos

| Campo | Descripción |
|---|---|
| `id` | Identificador estable en minúsculas, números y guiones |
| `answer` | Respuesta principal |
| `acceptedVariants` | Variantes separadas con `|` |
| `letter` | Letra del rosco |
| `relation` | `empieza` o `contiene` |
| `modes` | `general` o `teocratico`; admite varios con `|` |
| `categories` | Por ejemplo `general`, `lunfardo` o `argentinismo` |
| `wordDifficulty` | 1, 2 o 3; las respuestas infantiles deben usar 1 |
| `clueInfantil` | Pista concreta y breve para niños; no se deriva automáticamente de `clueFacil` |
| `clueFacil` | Pista directa para fácil |
| `clueIntermedio` | Pista descriptiva para intermedio |
| `clueAvanzado` | Pista indirecta para avanzado |
| `sourceName` | Nombre de la fuente editorial |
| `sourceUrl` | Enlace HTTPS específico |

Una entrada puede omitir pistas de niveles donde no deba aparecer.

## Validar

```bash
npm run content:validate
```

Detecta:

- Estructura o tipos incorrectos.
- Identificadores duplicados.
- Respuestas duplicadas dentro de un modo.
- Incompatibilidad entre la respuesta, la letra y `empieza`/`contiene`.
- Variantes redundantes.
- Fuentes provisionales.

## Reporte de cobertura

```bash
npm run content:report
```

Genera `reports/content-coverage.json` y presenta dos métricas por modo y dificultad:

- `jugables`: letras con al menos cuatro respuestas y cuatro distractores para una partida.
- `sostenibles`: letras con 28 candidatos compatibles, suficientes para seis partidas consecutivas respetando cinco partidas de enfriamiento.

## Control de publicación

```bash
npm run content:release-check
```

Además de validar, exige cobertura sostenible de 28 términos para cuatro jugadores, cuatro distractores y seis partidas consecutivas. El enfriamiento es una preferencia fuerte: si no hay alternativas, el generador reutiliza primero las palabras menos recientes y nunca bloquea una revancha.
