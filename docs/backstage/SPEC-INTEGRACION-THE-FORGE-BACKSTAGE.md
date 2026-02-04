# Especificación: Integración The Forge ↔ Backstage

**Propósito:** Definir arquitectura, flujo de datos y contrato entre The Forge y Backstage (Spotify) para que los documentos generados (MDD, Blueprint, OpenAPI, Infra) se consuman en Backstage y permitan crear la plantilla y el repositorio que el desarrollador descargará.

**Audiencia:** Arquitectos, implementadores backend/frontend de The Forge, y equipo que configura Backstage.

---

## 1. Objetivo de la integración

- The Forge **no genera código ejecutable**; genera **documentos de especificación** (MDD, Blueprint, OpenAPI, Flujos, Infra).
- Esos documentos deben poder **alimentar Backstage** para:
  1. Crear o seleccionar una **plantilla (Template)** en Backstage.
  2. Ejecutar el **Scaffolder** con los datos del proyecto (nombre, entidades, endpoints, stack, etc.) y producir un **repositorio** listo para que el dev clone y trabaje.

La integración se considera **completa** cuando: desde The Forge (estado VERDE) el usuario puede disparar la generación del repo en Backstage y el desarrollador puede descargar ese repo con la estructura y documentación embebida.

---

## 2. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│ THE FORGE                                                                │
│  WorkshopView → [VERDE] → "Generar repositorio en Backstage"             │
│       ↓                                                                  │
│  Backend: transformar documentos (MDD, Blueprint, API, Infra)            │
│       → Scaffold Manifest (YAML/JSON)                                    │
│       → (opcional) Cliente HTTP → Backstage Scaffolder API               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (Scaffold Manifest + API call)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ BACKSTAGE (Spotify)                                                      │
│  Scaffolder: POST /v2/tasks                                              │
│  Input: templateRef + values (mapeados desde Scaffold Manifest)          │
│  Steps: fetch:template → publish:github (o gitlab) → catalog:register   │
│  Output: repo URL, entityRef → dev clona repo                            │
└─────────────────────────────────────────────────────────────────────────┘
```

- **The Forge** es la fuente de verdad de los documentos y del "Scaffold Manifest".
- **Backstage** es el ejecutor: recibe el manifest (o sus campos vía API) y corre la plantilla para crear el repo.

---

## 3. Contrato: Scaffold Manifest

The Forge debe poder **exportar** un artefacto estructurado que Backstage (o una plantilla Backstage) pueda consumir. Ese artefacto se denomina **Scaffold Manifest**.

### 3.1 Formato recomendado: YAML (o JSON)

Un único archivo (ej. `scaffold-manifest.yaml`) que contenga al menos:

| Campo            | Tipo     | Origen en The Forge        | Uso en Backstage                                              |
| ---------------- | -------- | -------------------------- | ------------------------------------------------------------- |
| `projectName`    | string   | Nombre del proyecto / MDD  | `parameters.name`, nombre del repo                            |
| `description`    | string   | Resumen MDD o DBGA         | Descripción del repo / catalog-info                           |
| `owner`          | string   | Config/Usuario             | `parameters.owner` (OwnerPicker)                              |
| `repoUrl`        | string   | Usuario elige en Backstage | RepoUrlPicker (no viene de The Forge)                         |
| `entities`       | string[] | Parseado de MDD/Blueprint  | Lista de entidades para generar módulos/schemas               |
| `endpoints`      | array    | Parseado de API Contracts  | Rutas y métodos para documentar o generar stubs               |
| `stack`          | object   | Blueprint/MDD              | `backend`, `frontend`, `database` (ej. NestJS, React, Prisma) |
| `hasCicd`        | boolean  | Infra / TechnicalMetadata  | Incluir o no pipeline en skeleton                             |
| `hasMultiTenant` | boolean  | TechnicalMetadata          | Flags para plantilla                                          |
| `documents`      | object   | Contenido crudo o URLs     | MDD, Blueprint, OpenAPI, Infra como texto o referencias       |

Ejemplo mínimo (YAML):

```yaml
projectName: mi-producto
description: Sistema de ventas B2B con panel admin y app pública.
owner: team-platform
entities:
  - User
  - Order
  - Product
endpoints:
  - { method: GET, path: /api/orders }
  - { method: POST, path: /api/orders }
stack:
  backend: NestJS
  frontend: React
  database: Prisma
hasCicd: true
hasMultiTenant: false
documents:
  mdd: "# MDD\n..."
  blueprint: "# Blueprint\n..."
  openApi: "# OpenAPI\n..."
  infra: "# Infra\n..."
```

### 3.2 Origen de los datos en The Forge

- **projectName, description:** `Project.name`, resumen del MDD o DBGA.
- **owner:** Configuración del proyecto o del usuario (no hay campo estándar hoy; puede ser nuevo campo o default).
- **entities:** Parseo del MDD/Blueprint (ej. `mdd-markdown-parser.ts` o equivalente) para extraer entidades.
- **endpoints:** Parseo del documento de API Contracts (OpenAPI en Markdown o JSON).
- **stack, hasCicd, hasMultiTenant:** Blueprint + `TechnicalMetadata` del MDD.
- **documents:** Contenido de `Project.mddContent`, `blueprintContent`, `apiContractsContent`, documento de Infra.

La **transformación** de documentos Markdown → Scaffold Manifest es responsabilidad de un módulo/servicio en The Forge (ej. "Scaffold Export" o "MddToBackstage"); esta especificación no define el código, solo el contrato de salida.

---

## 4. Contrato con Backstage: API del Scaffolder

- **Endpoint:** `POST {BACKSTAGE_URL}/api/scaffolder/v2/tasks`
- **Autenticación:** Según instalación Backstage (token, cookie, etc.).
- **Body (resumen):** templateRef (ej. `template:default/the-forge-scaffold`) + `values`: objeto con los parámetros que la plantilla espera (nombre, owner, repoUrl, y opcionalmente entidades, stack, documentos, etc.).

Documentación oficial: [Scaffold API](https://backstage.io/docs/features/software-templates/api/scaffold/).

- **Respuesta:** 201 con `taskId`; el frontend de Backstage puede mostrar el progreso y el enlace al repo al finalizar.

The Forge puede:

- **Opción A:** Generar el Scaffold Manifest (YAML/JSON) y dejarlo descargable; el usuario copia los datos o sube el archivo a Backstage manualmente.
- **Opción B:** Además, implementar un cliente HTTP que llame a `POST /api/scaffolder/v2/tasks` con los `values` mapeados desde el Manifest, de modo que desde The Forge se dispare directamente la creación del repo en Backstage.

---

## 5. Flujo de datos resumido

1. Usuario en The Forge termina el diseño; semáforo en **VERDE**.
2. Usuario hace clic en "Generar repositorio en Backstage" (o equivalente).
3. Backend The Forge:
   - Lee documentos del proyecto (MDD, Blueprint, API, Infra).
   - Construye el **Scaffold Manifest** (YAML/JSON).
   - Si está configurada la integración: llama a Backstage `POST /api/scaffolder/v2/tasks` con `templateRef` + `values` derivados del Manifest.
4. Backstage ejecuta la plantilla (fetch skeleton, publish repo, register catalog).
5. Usuario/Dev recibe el enlace al repositorio y puede clonar; el repo contendrá la estructura y, si la plantilla lo soporta, los documentos (MDD, Blueprint, OpenAPI, Infra) embebidos.

---

## 6. Criterios de aceptación (para implementación)

- [ ] The Forge puede exportar un **Scaffold Manifest** en YAML o JSON con los campos descritos en §3.
- [ ] Los datos del Manifest se derivan de los documentos existentes (MDD, Blueprint, API, Infra) y de metadatos del proyecto.
- [ ] Documentación o guía para registrar en Backstage una plantilla que consuma esos parámetros (ver `GUIA-PLANTILLA-BACKSTAGE.md`).
- [ ] (Opcional) Cliente HTTP en The Forge que envíe los valores a Backstage Scaffolder API; configuración (URL, auth) documentada en runbook.

---

## 7. Referencias

- [Backstage Software Templates](https://backstage.io/docs/features/software-templates/)
- [Writing Templates](https://backstage.io/docs/features/software-templates/writing-templates)
- [Scaffold API](https://backstage.io/docs/features/software-templates/api/scaffold/)
- The Forge: `docs/THE-FORGE-INDEX.md`, `mdd.md` (§ Entregables finales).
