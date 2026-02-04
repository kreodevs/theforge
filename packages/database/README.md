# @the-forge/database

Prisma schema y client compartido.

- **Schema:** `schema.prisma` (Project, Session, Estimation, Status).
- **Client:** generado en `src/generated`; exportado por el package.

`pnpm db:generate` (o `pnpm build`) genera el client. `pnpm db:push` aplica el schema a la DB.
