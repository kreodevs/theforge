# Runbook: Ejecución de la integración The Forge ↔ Backstage

**Propósito:** Orden de ejecución y checklist para que tú o un equipo de devs ejecute la integración sin generar código en este paso (solo documentos y configuración).

---

## Prerrequisitos

- [ ] The Forge desplegado y funcional; semáforo VERDE disponible para al menos un proyecto de prueba.
- [ ] Backstage instalado y accesible; permisos para registrar templates y ejecutar Scaffolder.
- [ ] (Si se usa API) URL base de Backstage y método de autenticación (token, etc.) documentados y seguros.

---

## Orden de ejecución

### Fase 1: Documentos y contrato (The Forge)

1. [ ] Leer `docs/backstage/SPEC-INTEGRACION-THE-FORGE-BACKSTAGE.md` y alinear con el equipo.
2. [ ] Definir dónde se generará el Scaffold Manifest en The Forge (módulo/servicio "Scaffold Export" o "MddToBackstage"): entrada = proyecto (MDD, Blueprint, API, Infra), salida = YAML/JSON según §3 de la spec.
3. [ ] Implementar la generación del Manifest (parseo de documentos existentes; sin integración HTTP aún).
4. [ ] Validar: para un proyecto VERDE, exportar el Manifest y comprobar que contiene `projectName`, `description`, `entities`, `endpoints`, `stack`, `documents` (o los campos acordados).

### Fase 2: Plantilla en Backstage

5. [ ] Seguir `docs/backstage/GUIA-PLANTILLA-BACKSTAGE.md`: crear repo/carpeta de la plantilla, `template.yaml` con parameters y steps, skeleton con `catalog-info.yaml` y README.
6. [ ] Registrar la plantilla en el catálogo Backstage.
7. [ ] Probar manualmente: Create → The Forge Scaffold → rellenar con datos de prueba (incl. un Manifest de ejemplo) → publicar repo → clonar y verificar contenido.

### Fase 3: (Opcional) Integración por API

8. [ ] Configurar en The Forge: `BACKSTAGE_URL`, `BACKSTAGE_TEMPLATE_REF`, método de auth.
9. [ ] Implementar cliente HTTP que llame a `POST /api/scaffolder/v2/tasks` con `templateRef` + `values` mapeados desde el Scaffold Manifest.
10. [ ] En la UI de The Forge (WorkshopView), añadir botón "Generar repositorio en Backstage" que dispare la exportación del Manifest y la llamada a la API (o solo descarga del Manifest si no hay API).
11. [ ] Validar de punta a punta: VERDE → clic → repo creado en Backstage → dev puede clonar.

---

## Validación final

- [ ] Un desarrollador puede, partiendo de un proyecto VERDE en The Forge, obtener un repositorio en Backstage con la estructura y documentación acordada.
- [ ] La plantilla Backstage está documentada y mantenible (guía + spec).
