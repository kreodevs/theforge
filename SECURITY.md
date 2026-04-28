# Security policy (The Forge)

## Credenciales y secretos

- **No commitear** `.env`, `auth.json`, `auth.lock`, claves API ni tokens. Usar solo `.env.example` con valores vacíos o placeholders.
- **`auth.json`** (Hermes / agente local): debe existir solo en tu máquina; está en `.gitignore`. Si alguna vez se subió a Git, la clave queda en el historial público hasta purgarlo (ver abajo).

## Reportar vulnerabilidades

Abre un issue **privado** o contacta a los mantenedores listados en [AUTHORS.md](AUTHORS.md) sin publicar detalles explotables hasta acordar divulgación.

## Si filtraste una clave (respuesta rápida)

1. **Revocar** la clave en el proveedor (OpenRouter ya deshabilitó la afectada).
2. **Generar** una clave nueva y configurarla solo en entorno seguro (Dokploy, `.env` local, secret manager).
3. **Quitar el archivo del índice de Git** (si seguía trackeado pese a `.gitignore`):

   ```bash
   git rm --cached auth.json
   ```

4. **Purgar el historial** en todos los clones y en GitHub (obligatorio si el repo fue público):

   ```bash
   # Instalar: brew install git-filter-repo
   cd /ruta/al/theforge
   git filter-repo --path auth.json --invert-paths --force
   git push origin --force --all
   git push origin --force --tags
   ```

   Avisar a quien tenga fork/clone para **re-clonar** o resetear duro tras el rewrite.

5. En GitHub: **Settings → Security** — revisar alertas de secret scanning; rotar cualquier otro secreto que compartiera el mismo archivo o commit.
