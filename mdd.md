# MDD: "TheForge" - Software Factory Orchestrator

**Versión:** 1.0 (Producción) | **Arquitectura:** Monorepo (Turborepo) | **Estado del Semáforo:** 🟢 Listo para implementación.

---

## 1. Resumen Ejecutivo y Alcance

**TheForge** es una plataforma interna diseñada para centralizar la creación de software. Su objetivo es transformar una entrevista técnica proactiva en un paquete de ingeniería de alta precisión (+90%) para ser ejecutado por agentes de IA (Cursor/Antigravity) o desarrolladores humanos.

- **Pilar de Negocio:** Reducir el tiempo de desarrollo de meses a semanas.
- **Pilar de Gestión:** Proveer estimaciones automáticas de costo (MXN) y tiempo.
- **Pilar de Calidad:** Bloquear la generación de código si el diseño es incompleto (Semáforo de Calidad).

---

## 2. Arquitectura de Software

Para garantizar escalabilidad y despliegue profesional, se utilizará una estructura de **Monorepo**.

### 2.1 Stack Tecnológico

- **Backend:** NestJS (Node.js).
- **Frontend:** React (Vite) con Tailwind CSS.
- **Base de Datos:** PostgreSQL con Prisma ORM.
- **Colas de Procesamiento:** Redis + BullMQ (para tareas pesadas de IA).
- **Infraestructura:** Docker (Dokploy-ready).

### 2.2 Estructura del Monorepo (Turborepo)

Plaintext

`/theforge
/apps
/api <-- Backend NestJS
/web <-- Frontend React
/packages
/database <-- Esquema de Prisma y migraciones
/shared-types <-- Interfaces de TS compartidas (DTOs)
/config <-- ESLint, Tailwind y TSConfigs

- docker-compose.yml
- turbo.json`

---

## 3. Integración de IA Agnóstica (Strategy Pattern)

El tráfico LLM sale por **OpenRouter**; el contrato de negocio sigue siendo `LLMProvider`.

- **Contrato:** Interfaz `LLMProvider` que define métodos para: `entrevistar()`, `analizarContexto()` y `generarBlueprint()`.
- **Implementación:** `OpenRouterAdapter` (SDK `openai` → `https://openrouter.ai/api/v1`). Modelo de chat por defecto: `nousresearch/hermes-3-llama-3.1-405b` (`OPENROUTER_CHAT_MODEL`).
- **Configuración:** `OPENROUTER_API_KEY` (o alias `AI_API_KEY` / `OPENAI_API_KEY`), opcional `OPENROUTER_*` en `llm-config.ts`.

---

## 4. Lógica de Negocio y Funcionalidades Core

### 4.1 Entrevista Proactiva y Persistencia

- **Trabajo Asíncrono:** El sistema guarda el estado de la entrevista en cada interacción.
- **Checkpoints:** Si el usuario se retira, la IA retoma el hilo analizando los logs previos.

### 4.2 El Semáforo del MDD (Control de Calidad)

El sistema analiza el documento en tiempo real y asigna un estado:

1. **🔴 Rojo (Bloqueado):** Faltan entidades, stack o lógica núcleo.
2. **🟡 Amarillo (Advertencia):** Lógica presente pero faltan tipos de datos o casos de borde (Precisión ~70%).
3. **🟢 Verde (Liberado):** Definición completa, contratos de API listos y mapeo UX (Precisión +95%).

### 4.3 Flujo de Diseño (UX/UI Switch)

- **Con equipo UX:** La app solicita la carga del mapeo de componentes de Figma (vía MCP).
- **Sin equipo UX:** La IA tiene libertad para proponer la arquitectura visual basada en Shadcn/UI.

---

## 5. Motor de Estimación (Mercado México 2026)

Cálculo manual (no IA) basado en la complejidad del MDD detectado.

**Tarifas Hora (MXN):**

- Architect/Lead: $1,500
- Backend: $950
- Frontend: $850
- UX/UI: $750

**Fórmula de Esfuerzo:**

- $Horas_{Total} = ((\text{Entidades} \times 12) + (\text{Pantallas} \times 16)) \times 1.25$

---

## 6. Configuración de Despliegue (Dokploy/Docker)

La aplicación se desplegará mediante Dokploy usando contenedores Docker multietapa.

- **Servicio 1:** API (Node.js).
- **Servicio 2:** Web (Nginx sirviendo el build de React).
- **Servicio 3:** PostgreSQL.
- **Servicio 4:** Redis (Cache/Colas).

---

## 7. Entregables Finales (Output de TheForge)

El **Master Design Doc** actúa como **Constitución del proyecto** según Specification-Driven Development (SDD): se establece o refina primero, y todo lo que se genere después (blueprint, contratos, infra) debe cumplirlo. Donde aplique, los entregables incluyen un breve checklist de cumplimiento con el MDD.

Cuando el semáforo esté en **Verde**, la aplicación generará:

1. **Master Design Doc:** PDF/Markdown completo del proyecto (Constitución del proyecto).
2. **Implementation Blueprint:** Diccionario de archivos y responsabilidades.
3. **OpenAPI Spec:** Contrato de API para integración inmediata.
4. **Project Scaffold:** Repositorio base con carpetas creadas y archivo `.cursorrules` configurado.
