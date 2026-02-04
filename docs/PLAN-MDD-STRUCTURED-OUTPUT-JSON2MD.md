# Plan de implementación: MDD con salida estructurada y json2md

## Objetivo

Sustituir el flujo actual (agentes → markdown libre → parser/sanitizer) por un flujo donde:
1. El estado central es un **objeto estructurado** (schema Zod) que representa el MDD.
2. Cada agente **devuelve solo su slice** del schema (o el schema completo con su parte rellena).
3. El **markdown** se genera siempre con una función determinista: `mddStructuredToMarkdown(mddStructured)` usando **json2md** + converters custom para SQL, mermaid y TechnicalMetadata.
4. Auditor y estimación siguen consumiendo markdown (renderizado desde el objeto); opcionalmente más adelante pueden consumir el objeto para validación directa.

---

## 1. Schema del MDD (Zod)

Definir en un módulo compartido (p. ej. `state/mdd-structured.schema.ts` o `types/mdd-structured.ts`) el tipo que representa el documento completo. Debe ser **extensible** (nuevas secciones = nuevos campos opcionales o un bloque `customSections`).

```ts
// Esquema conceptual (Zod real en el código)

MddStructured = {
  title?: string;                    // "Master Design Document" | "Master Design Document: SSO"
  contextoAlcance?: string;          // markdown o prosa (o array de bloques si queremos más control)
  modeloDatos?: {
    sql: string;
    diagramaEr?: string;             // contenido mermaid (sin ```mermaid)
    technicalMetadata?: string[];   // ["[high_security]"]
  };
  contratosApi?: {
    summary?: string;                // tabla resumen en texto
    endpoints?: Array<{
      method: string;
      path: string;
      description?: string;
      requestBody?: string;          // JSON string o undefined
      responses?: Record<string, string>;
    }>;
  };
  arquitecturaFrontend?: string;      // markdown de la sección 4
  seguridad?: Array<{
    title: string;
    content: string[];               // viñetas o párrafos
  }>;
  integracion?: Array<{
    title: string;
    content: string | string[];      // párrafo o viñetas
  }> | { subsections: Array<{ title: string; content: string | string[] }>; manifest?: object };
  customSections?: Array<{ heading: string; body: string }>;  // extensibilidad
}
```

- **contextoAlcance**: string es suficiente para no complicar; si luego queremos viñetas estrictas, se puede cambiar a `{ bullets: string[] }`.
- **integracion**: puede ser array de subsecciones (como Seguridad) o un objeto con `subsections` + `manifest` para el JSON de infra.
- **customSections**: permite que un agente futuro añada "5. Riesgos" sin tocar el schema core.

---

## 2. Dependencia y módulo de render

- **Añadir** `json2md` al `package.json` de `apps/api`.
- **Crear** módulo `mdd-structured-to-markdown.ts` (o `render/mdd-to-markdown.ts`) que:
  - Reciba `MddStructured`.
  - Convierta cada sección a la forma que json2md entiende: array de `{ h1 }, { h2 }, { p }, { ul }, { code: { language, content } }`.
  - **Converters custom** (json2md permite extender `json2md.converters`): por ejemplo `sql`, `mermaid`, `technicalMetadata` para generar bloques ```sql, ```mermaid, ```TechnicalMetadata.
  - Invocar `json2md(array)` y post-procesar si hace falta (separadores `---`, orden exacto).
- **Contrato**: `mddStructuredToMarkdown(mdd: MddStructured): string`. Esta función es la **única** que genera markdown a partir del objeto; no debe haber lógica duplicada.

Referencia: [json2md](https://github.com/IonicaBizau/json2md) – soporta h1–h6, p, ul, ol, code, table; podemos añadir converters para nuestros bloques.

---

## 3. Estado del grafo

- **Opción A (recomendada)**: Añadir `mddStructured: MddStructured` al state; mantener `mddDraft: string` como **derivado** para compatibilidad: cada vez que se actualice `mddStructured`, calcular `mddDraft = mddStructuredToMarkdown(mddStructured)`. Quien ya lee `mddDraft` (Auditor, Estimation, UI) sigue recibiendo markdown.
- **Opción B**: Solo `mddStructured`; en los puntos de salida (stream done, getMddContentForProject) se renderiza a markdown. Implica tocar todos los sitios que leen `mddDraft` para que lean `mddStructured` y rendericen.

Recomendación: **Opción A** durante la migración; el state tiene ambos, pero la fuente de verdad es `mddStructured`. Cuando todos los nodos escriban solo en `mddStructured`, podemos deprecar la escritura directa en `mddDraft`.

- **Estado actual**: `mddStateSchema` con `mddDraft: z.string()`.
- **Cambio**: añadir `mddStructured: z.optional(mddStructuredSchema)` (o el tipo que definamos). En los nodos que ya rellenan secciones, en lugar de `replaceOrAppendSection(draft, sectionName, content)` harán `mergeMddStructured(state.mddStructured, { [sectionKey]: payload })`. Nueva función `mergeMddStructured(prev, slice)` que hace deep merge de las claves del slice en prev.

---

## 4. Agentes: de markdown a structured output

Cada agente que hoy escribe en `mddDraft` pasará a devolver un **objeto parcial** (su slice). El grafo fusionará ese slice en `mddStructured` y luego actualizará `mddDraft` desde `mddStructuredToMarkdown(mddStructured)`.

| Agente | Hoy | Después |
|--------|-----|--------|
| **Clarifier** | `mddDraft` (texto) + `clarifiedScope` | `mddStructured`: `{ title, contextoAlcance }`; `clarifiedScope` se mantiene. |
| **Data model expert** | Reemplaza sección "Modelo de datos" en string | Devuelve `{ modeloDatos: { sql, diagramaEr?, technicalMetadata? } }`; merge en `mddStructured`. |
| **Software architect** | Reemplaza sección 3 (API) en string | Devuelve `{ contratosApi: { summary?, endpoints[] } }`; merge. |
| **Frontend architect** | Reemplaza sección 4 en string | Devuelve `{ arquitecturaFrontend: string }`; merge. |
| **Security** | Reemplaza "## Seguridad" en string | Devuelve `{ seguridad: [{ title, content[] }] }`; merge. |
| **Integration** | Reemplaza "## Integración" en string | Devuelve `{ integracion: { subsections[], manifest? } }` o array; merge. |
| **Redactor** | Reescribe todo el markdown | **Opción 1**: Eliminar; el documento unificado es el merge + render. **Opción 2**: Redactor recibe `mddStructured` y devuelve `mddStructured` (unificar tono, sin tocar estructura). |
| **Formatter** | `normalizeMddFormat(mddDraft)` | Ya no normaliza markdown; solo asegura que `mddStructured` esté completo y luego `mddDraft = mddStructuredToMarkdown(mddStructured)`. Si hay campos vacíos, el render puede poner "(Pendiente)". |
| **Diagram injector** | Inserta Mermaid en el string de la sección 2 | Lee `mddStructured.modeloDatos`, genera/mejora `diagramaEr`, escribe en `mddStructured.modeloDatos.diagramaEr`; luego se re-renderiza. |
| **Auditor** | Recibe `mddDraft` (markdown) | Sigue recibiendo markdown (renderizado desde `mddStructured`). Sin cambios en la lógica de validación por ahora. |

- **Prompts**: Cada agente debe indicar que su salida es **solo** un objeto JSON con la forma del slice (ej. `{ seguridad: [ { title: "...", content: ["..."] } ] }`). Usar **structured output** del LLM (OpenAI `response_format`, Anthropic tool result, etc.) cuando el stack lo permita para que el modelo no devuelva texto libre.
- **Parsing**: Si un agente aún devuelve texto (durante la transición), se puede intentar extraer JSON del mensaje y validar con Zod; si falla, fallback a “poner ese texto en la sección correspondiente como string” (un solo bloque de markdown en esa sección) para no romper el flujo.

---

## 5. Merge de secciones y reemplazo de `replaceOrAppendSection`

- **Nueva función** `mergeMddStructured(prev: MddStructured | null, slice: Partial<MddStructured>): MddStructured` que hace merge profundo: las claves presentes en `slice` sobrescriben las de `prev` (para objetos anidados, hacer merge recursivo; para arrays como `seguridad`, reemplazar por el nuevo array).
- Sustituir llamadas a `replaceOrAppendSection(draft, sectionName, content)` por algo como:
  - `mergeMddStructured(state.mddStructured, { seguridad: parsedSecurity })`
  - y luego `mddDraft = mddStructuredToMarkdown(state.mddStructured)` (o actualizar state con `mddStructured` y un reducer que derive `mddDraft`).

---

## 6. Formatter y Diagram Injector

- **Formatter node**:  
  - Entrada: `state.mddStructured` (y opcionalmente `state.mddDraft` si aún hay fuentes que escriben en draft).  
  - Si existe `mddStructured`, `mddDraft = mddStructuredToMarkdown(mddStructured)`.  
  - Si no existe (flujo viejo o primera pasada), se puede dejar que el resto del pipeline siga escribiendo en `mddDraft` y al final un “normalizer” convierta `mddDraft` → `mddStructured` (parseo heurístico) y luego vuelva a renderizar; así se mantiene compatibilidad durante la migración.
- **Diagram injector**:  
  - Entrada: `state.mddStructured`.  
  - Si hay `modeloDatos.sql` y no hay o está vacío `modeloDatos.diagramaEr`, generar erDiagram desde el SQL e insertarlo en `modeloDatos.diagramaEr`.  
  - Salida: mismo `mddStructured` con `modeloDatos.diagramaEr` actualizado; el state se actualiza y se re-deriva `mddDraft`.

---

## 7. Auditor y Estimation

- Siguen recibiendo **markdown** (`state.mddDraft` o el string que se envía en el evento `done`). Ese markdown será siempre el resultado de `mddStructuredToMarkdown(mddStructured)`, por lo que la estructura (títulos, secciones, bloques) será consistente.
- **validateMddStructure** y las funciones que parsean el markdown (detectReferenceSections, parseCountsFromMarkdown) siguen igual; no hace falta cambiarlas en la primera fase.
- Opcional (fase posterior): exponer `mddStructured` a la tool del Auditor para que pueda reportar gaps por sección (ej. “modeloDatos sin sql”) sin depender del regex sobre markdown.

---

## 8. Compatibilidad hacia atrás y migración gradual

- **Inicio de flujo sin `mddStructured`**: Si el Manager/Clarifier arranca sin benchmark, `mddStructured` puede inicializarse como `{}` o con `title: "Master Design Document"`. El Clarifier rellena `contextoAlcance` (y quizá `title`). Los siguientes agentes rellenan su slice.
- **Checkpoints antiguos**: Implementado `markdownToMddStructured(draft)` en `utils/mdd-markdown-to-structured.ts` (heurística: secciones por ##, SQL en ```sql, mermaid, TechnicalMetadata). Si no se usa o el parseo falla, `mddStructured` queda vacío y el siguiente agente hace merge con `{}`; Formatter y prepareMddForOutput usan `mddDraft` cuando no hay contenido en `mddStructured`.
- **Orden de migración sugerido** (por impacto y beneficio):
  1. Schema Zod + `mddStructuredToMarkdown` + json2md (y tests con un MDD de ejemplo).
  2. State: añadir `mddStructured` y `mergeMddStructured`; formatter que, si hay `mddStructured`, derive `mddDraft` desde él.
  3. Data model expert → structured (modeloDatos); luego Security → seguridad; luego Integration → integracion (los que más problemas daban).
  4. Clarifier → title + contextoAlcance; Software architect → contratosApi; Frontend → arquitecturaFrontend.
  5. Diagram injector que opere sobre `mddStructured`.
  6. Redactor: eliminar o convertir en “merge + opcional unificador de tono” sobre `mddStructured`.
  7. Deprecar escritura directa en `mddDraft`; todo pasa por `mddStructured` y render.

---

## 9. Extensibilidad (nuevas secciones)

- Añadir una sección nueva (ej. “5. Riesgos”) implica:
  1. Añadir al schema un campo opcional (ej. `riesgos?: Array<{ title: string; content: string[] }>`) o usar `customSections: [{ heading: "5. Riesgos", body: "..." }]`.
  2. En `mddStructuredToMarkdown`, mapear ese campo a los elementos json2md que correspondan (h2 + ul/p).
  3. Un agente (nuevo o existente) que devuelva ese slice y hacer merge.
- No hace falta tocar regex ni sanitizers de markdown; todo es añadir tipo y rama en el render.

---

## 10. Resumen de tareas (checklist)

- [ ] **Schema**: Definir `MddStructured` en Zod y exportar tipo; documento de referencia (README o comentarios) con la forma de cada sección.
- [ ] **json2md**: Añadir dependencia; implementar `mddStructuredToMarkdown` con converters para `sql`, `mermaid`, `technicalMetadata`; tests con un MDD completo.
- [ ] **State**: Añadir `mddStructured` al state; implementar `mergeMddStructured`.
- [ ] **Formatter**: Actualizar para que, si existe `mddStructured`, derive `mddDraft` con `mddStructuredToMarkdown`.
- [ ] **Data model expert**: Cambiar salida a `{ modeloDatos }`; nodo hace merge y actualiza `mddDraft` desde render.
- [ ] **Security**: Cambiar salida a `{ seguridad: [...] }`; merge.
- [ ] **Integration**: Cambiar salida a `{ integracion: ... }`; merge.
- [ ] **Clarifier**: Cambiar salida a `{ title?, contextoAlcance }`; merge.
- [ ] **Software architect**: Cambiar salida a `{ contratosApi }`; merge.
- [ ] **Frontend architect**: Cambiar salida a `{ arquitecturaFrontend }`; merge.
- [ ] **Diagram injector**: Leer/escribir `mddStructured.modeloDatos.diagramaEr`.
- [ ] **Redactor**: Eliminar o adaptar a “solo merge/validación” sobre `mddStructured`; sin reescritura de markdown libre.
- [ ] **Compatibilidad**: Función opcional `markdownToMddStructured` para checkpoints viejos; documentar comportamiento cuando `mddStructured` está vacío.
- [ ] **Limpieza**: Reducir o eliminar sanitizers/parsers que solo existían para corregir markdown (sanitizeSeguridadIntegracionRawJson, unwrapSection2SqlBlockContainingJson, etc.) una vez que todo pase por structured; mantener solo lo que siga siendo necesario para `markdownToMddStructured` si se usa.

---

## 11. Criterios de éxito

- Un único lugar donde se genera markdown: `mddStructuredToMarkdown`.
- Agentes sin lógica de “formato de salida”; solo devuelven datos que cumplen el schema.
- Añadir una sección nueva requiere solo extensión del schema + rama en el render + un agente que rellene ese slice.
- Auditor y Estimation siguen funcionando sin cambios en su API (reciben markdown).
- Tests: dado un `MddStructured` de referencia, el markdown generado contiene las secciones esperadas y bloques ```sql / ```mermaid / ```TechnicalMetadata correctos.
