# @the-forge/web

Frontend React (Vite) + Tailwind de The Forge.

- Lista y creación de proyectos; semáforo (ROJO/AMARILLO/VERDE).
- Landing con cards (Nuevo proyecto, Proyectos), empty state con icono y CTA "Crear primer proyecto", iconos lucide-react en header y botones.
- **Documentos en markdown (MDD, Blueprint, Contratos API, Flujos, Infra):** cada uno en su pestaña en el Workshop; previsualización por defecto, botón "Ver fuente" para editar el markdown, auto-guardado con debounce (1,5 s) y persistencia vía PATCH al proyecto; botón "Regenerar" para regenerar desde el MDD (Blueprint, Contratos API, Casos de Uso y Flujos, Infraestructura y Despliegue).
- Proxy `/api` al backend en dev. En prod, Nginx hace proxy.

`pnpm dev` → http://localhost:5173
