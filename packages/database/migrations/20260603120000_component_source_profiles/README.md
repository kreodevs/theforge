# Component Source Profiles migration

Apply with your usual DB workflow (`pnpm db:push` or manual SQL).

## What it does

1. Creates `ComponentSourceProfile` (user-owned MCP credentials + mapping metadata).
2. Adds nullable `Project.componentSourceProfileId` (FK `ON DELETE RESTRICT`).
3. Copies legacy `User.componentSource*` rows into one profile per user named **Perfil migrado**.
4. Does **not** assign profiles to projects — owners must pick explicitly in UI/API.

## Rollback notes

- Drop FK/index/column on `Project`, then drop `ComponentSourceProfile`.
- Legacy `User.componentSource*` columns remain for backward compatibility until Phase 2 cleanup.
