# auth

- **`POST /auth/otp/request`** — body `{}` opcional (si incluye `email` se ignora). Respuesta `{ ok: true }`. El OTP solo se envía al correo de **`EMAIL_OTP`** / **`AUTH_ALLOWED_OTP_EMAIL`**. **Producción:** `EMAIL_OTP` o `AUTH_ALLOWED_OTP_EMAIL` obligatorio al arranque; `SMTP_*` para envío real. **Desarrollo:** sin SMTP el código va a logs.
- **`POST /auth/otp/verify`** — body `{ code }` (opcional `email`, ignorado). `upsert` de `User` con el correo autorizado y JWT (`sub` = `User.id`, `role: admin`). Respuesta `{ accessToken, user: { email, role: "admin" } }`.

Variables: `SMTP_PORT` (default 587), `SMTP_SECURE=1` solo si el servidor exige TLS directo. `SMTP_FROM` puede ser solo nombre visible; si no incluye `@`, se usa `SMTP_USER` como dirección.

**Passport:** `JwtStrategy` (`passport-jwt`) valida el Bearer; `JwtAuthGuard` extiende `AuthGuard('jwt')` y respeta `@Public()`.

Constantes en `auth.constants.ts`; JWT global vía `AuthModule`; guard global en `app.module` con `@Public()` en `/health` y `/auth/*`. El interceptor `UserContextInterceptor` guarda `userId` en `AsyncLocalStorage` para que `ProjectsService` / `SessionsService` acoten por propietario sin pasar el id en cada firma.
