# Prompts legacy (descubrimiento escalonado)

- **`staged-discovery-mdd-prompt.md`** — System prompt Plan-and-Execute para MDD inicial / evidencia de cambio. Contiene el placeholder `{{theforgeProjectId}}`, sustituido en runtime por `hydrateStagedDiscoveryMddPrompt` en `staged-discovery-mdd.loader.ts` tras resolver el UUID con `AgentSupervisor` + proyecto.
