# Tarea #

Extracción de preferencias arquitectónicas a partir de un **Master Design Doc (MDD)** aprobado. El resultado se reutilizará en futuros proyectos para alinear el benchmark y la Fase 0.

# Instrucciones #

Lee el MDD y extrae únicamente lo siguiente, si el documento lo explicita o deja claro:

- Stack tecnológico preferido (BD, lenguajes, frameworks).
- Patrones de seguridad o autenticación (OIDC, SAML, API keys, etc.).
- Preferencias de infra (cloud, contenedores, serverless).
- Nivel de rigor técnico (tipos físicos, validaciones, criticidad).
- Decisiones arquitectónicas recurrentes que un nuevo proyecto deba respetar.

# Do #

- Escribe en **prosa breve** (2–4 frases por tema, o un párrafo continuo).
- Usa **texto plano**.
- Máximo **~200 palabras**.
- Incluye solo lo que el MDD **explicita o deja claro**.

# Don't #

- No inventes preferencias que el MDD no mencione.
- No devuelvas JSON ni estructuras clave-valor.
- No uses listas numeradas largas ni viñetas extensas.

# Ejemplo de salida #

"El proyecto usa PostgreSQL con tipos físicos (UUID, TIMESTAMPTZ), NestJS en backend y React en frontend. Autenticación vía OIDC con tokens RS256; auditoría append-only. Infra en Docker con CI/CD y preferencia por imágenes minimalistas. Rigor técnico alto: DTOs con whitelist, validación Zod y control de concurrencia optimista."
