# docs

Documentación de arquitectura de The Forge.

| Archivo / Carpeta                              | Uso                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **THE-FORGE-INDEX.md**                         | Índice unificado: flujo, IA agnóstica (OpenAI/Gemini), Semáforo, estimación, despliegue Dokploy. Referencia para el agente y para implementaciones.      |
| **APRENDIZAJES.md**                            | Conocimiento y experiencia para juniors: qué pedimos, cómo lo pedimos, errores, pivotes, tiempos. Actualizar con cada sesión relevante.                  |
| **PLAN-FASE0-SCRAPING-DEEP-RESEARCH.md**       | Plan: URLs en Paso 0, scraping con Cheerio, HTML→Markdown, integración con benchmark y deep research con LLM (documento resumen).                        |
| **PLAN-MDD-ARQUITECTO-NO-ACTUALIZA-MODELO.md** | Plan: causas raíz por las que el Arquitecto no actualiza §3 y el MDD no refleja cambios (roles por aplicación, etc.); mejoras alineadas con SDD/Agentic. |
| **backstage/**                                 | Integración con Backstage (para más adelante, no decidida): spec, guía de plantilla y runbook. Ver `backstage/README.md`.                                |

Fuentes: `blueprint.md`, `mdd.md` en la raíz del repo. El monorepo está construido según ese índice (apps/api, apps/web, packages/\*, docker-compose).
