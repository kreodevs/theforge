# Implementation Blueprint: "The Forge"

**Objetivo:** Guía de construcción técnica para Cursor AI basada en el MDD v1.0. El MDD actúa como **Constitución del proyecto** (SDD): el Blueprint se genera leyendo y cumpliendo el MDD; no debe contradecirlo.

## 1. Estructura del Monorepo (Turborepo)

Se debe inicializar el proyecto con la siguiente jerarquía de archivos para asegurar compatibilidad con **Dokploy** y **Prisma shared-types**.

Plaintext

`/the-forge (Root)
├── apps/
│   ├── api/                # NestJS Backend
│   └── web/                # React (Vite) Frontend
├── packages/
│   ├── database/           # Prisma Schema & Client
│   ├── shared-types/       # Interfaces y DTOs (shared)
│   └── config/             # Configuración TS, ESLint, Tailwind
├── docker-compose.yml      # Orquestación Dokploy
├── turbo.json              # Configuración de Pipeline
└── .cursorrules            # Reglas de desarrollo para el Agente`

---

## 2. Definición de la Base de Datos (`packages/database/schema.prisma`)

El esquema debe soportar el trabajo "a ratos" y el motor de costos.

Fragmento de código

`model Project {
id String @id @default(uuid())
name String
hasUxTeam Boolean @default(false)
status Status @default(ROJO) // Semáforo
precisionScore Int @default(0)
sessions Session[]
estimation Estimation?
figmaMapping Json? // Mapeo cargado por el UX
mddContent String? @db.Text
createdAt DateTime @default(now())
}

model Session {
id String @id @default(uuid())
projectId String
project Project @relation(fields: [projectId], references: [id])
chatLog Json // Array de {role: 'user'|'assistant', content: string}
contextStep String // 'CONTEXT', 'DATA', 'LOGIC', 'SECURITY'
updatedAt DateTime @updatedAt
}

model Estimation {
id String @id @default(uuid())
projectId String @unique
project Project @relation(fields: [projectId], references: [id])
totalHours Float
totalMxn Float
teamStructure Json // {architect: 1, back: 2, ...}
}

enum Status { ROJO, AMARILLO, VERDE }`

---

## 3. Lógica de IA Agnóstica (`apps/api/src/modules/ai/`)

Implementar el patrón Strategy para alternar entre proveedores.

- **`interfaces/llm-provider.interface.ts`**:
  - `abstract generateResponse(prompt, history): Promise<string>`
  - `abstract parseChecklist(text): Promise<ChecklistResult>`
- **`adapters/openai.adapter.ts`**: Implementación usando `openai` SDK.
- **`adapters/gemini.adapter.ts`**: Implementación usando `@google/generative-ai`.
- **`ai.factory.ts`**: Clase que instancia el adaptador basado en `process.env.AI_PROVIDER`.

---

## 4. Motor de Estimación (`apps/api/src/modules/engine/`)

Lógica pura (no IA) para el cálculo en Pesos Mexicanos.

- **`cost-calculator.service.ts`**:
  - Recibe el conteo de entidades y pantallas del MDD.
  - Aplica: $H_{total} = ((\text{Entidades} \times 12) + (\text{Pantallas} \times 16)) \times 1.25$.
  - Multiplica por tarifas: Architect ($1500), Back ($950), Front ($850), UX ($750).

---

## 5. El Semáforo del MDD (Validador de Calidad)

Servicio en el Backend que analiza el JSON del proyecto.

- **Reglas de Estado:**
  - **ROJO:** Si `db_entities.length == 0` o `business_core == null`.
  - **AMARILLO:** Si hay entidades pero faltan `edge_cases` o `field_types`.
  - **VERDE:** Si todos los campos del checklist están al 100% y hay mapeo de UX (si aplica).

---

## 6. Configuración de Despliegue (Dokploy-Ready)

### `docker-compose.yml` (Simplificado)

YAML

`services:
  api:
    build: .
    context: ./apps/api
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - AI_PROVIDER=${AI_PROVIDER}
  web:
    build: .
    context: ./apps/web
  db:
    image: postgres:15-alpine
  redis:
    image: redis:alpine # Para BullMQ (procesamiento IA)`

---

## 7. Instrucciones para el Agente (Cursor/Antigravity)

Cuando inicialices el proyecto, dile a Cursor:

1. "Lee `@blueprint.md` y `@MDD.md`."
2. "Comienza creando el Monorepo con Turborepo."
3. "Configura `packages/database` con el esquema de Prisma proporcionado."
4. "Implementa el `LLMProvider` asegurando que sea agnóstico (OpenAI/Gemini)."
5. "Crea la lógica del Semáforo en el Backend para que valide la completitud de la entrevista."
