/**
 * Constantes de auth.
 *
 * Históricamente este archivo contenía `DEFAULT_ALLOWED_OTP_EMAIL` (email único hardcodeado para OTP)
 * y las envs `EMAIL_OTP` / `AUTH_ALLOWED_OTP_EMAIL`. Eso se eliminó: ahora el email del OTP viene
 * en el body del request y se valida contra la tabla `User`. Cada usuario tiene su propio mcpSecret.
 */
export const ADMIN_ROLE = "admin";
