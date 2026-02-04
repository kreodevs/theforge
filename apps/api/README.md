# @the-forge/api

Backend NestJS de The Forge.

- **Módulos:** Projects, Sessions, AI (adapters OpenAI/Gemini), Engine (cost-calculator, semáforo).
- **DB:** Prisma + PostgreSQL (schema en `packages/database`).
- **IA:** `AI_PROVIDER=openai|google`; factory inyecta el adapter.

Env: `DATABASE_URL`, `AI_PROVIDER`, `OPENAI_API_KEY` o `GOOGLE_GENERATIVE_AI_API_KEY`.
