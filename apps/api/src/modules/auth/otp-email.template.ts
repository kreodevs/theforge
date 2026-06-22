/** Brand tokens aligned with the web login theme (warm Claude+ palette). */
const COLORS = {
  pageBg: "#faf8f5",
  cardBg: "#ffffff",
  cardBorder: "#e8e4dc",
  primary: "#b5633a",
  primarySoft: "#f3ebe4",
  text: "#2d2926",
  muted: "#6b6560",
  codeBg: "#f7f4ef",
  codeBorder: "#ebe5dc",
  footer: "#9a948c",
} as const;

export type OtpEmailContent = {
  subject: string;
  text: string;
  html: string;
};

/** Inline logo (no CID attachments — avoids Gmail showing image files as attachments). */
const LOGO_BLOCK = `<div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:16px;background:${COLORS.primarySoft};border:1px solid ${COLORS.cardBorder};font-size:28px;text-align:center;margin:0 auto 14px;box-shadow:0 2px 12px -4px rgba(181,99,58,0.22);">&#128293;</div>`;

function buildCopyButton(handoffUrl: string): string {
  return `<a href="${handoffUrl}" title="Copiar código" aria-label="Copiar código" style="display:inline-block;padding:10px 16px;border-radius:12px;border:1px solid #dfc4b3;background:#ffffff;color:${COLORS.primary};font-size:13px;font-weight:600;text-decoration:none;vertical-align:middle;letter-spacing:0.02em;box-shadow:0 1px 4px rgba(74,44,28,0.08);white-space:nowrap;">copiar</a>`;
}

/**
 * HTML + plain-text OTP email aligned with the login screen.
 * No embedded attachments: logo and copy icon are pure HTML.
 * The code is rendered without literal spaces so copy/paste into the 6-digit field works.
 */
export function buildOtpEmailContent(args: {
  code: string;
  email: string;
  appBaseUrl: string | null;
}): OtpEmailContent {
  const { code, email, appBaseUrl } = args;
  const appOrigin = appBaseUrl?.replace(/\/$/, "") ?? null;
  const handoffUrl = appOrigin
    ? `${appOrigin}/auth/otp?otp=${code}&email=${encodeURIComponent(email)}`
    : null;

  const textLines: string[] = [
    code,
    "",
    "The Forge · Acceso sin contraseña",
    "",
    "Hola,",
    "",
    "Usa este código de un solo uso para iniciar sesión en The Forge:",
    "",
    code,
    "",
    handoffUrl
      ? "Pulsa «copiar» junto al código y pégalo en el login de The Forge."
      : "Selecciona y copia los 6 dígitos, luego pégalos en la pantalla de inicio de sesión.",
    "",
    "Caduca en 10 minutos. Si no solicitaste este acceso, ignora este mensaje.",
    "",
    "—",
    "The Forge · Proyecto de código abierto · Apache License 2.0",
  ];
  if (handoffUrl) textLines.push("", `Copiar código: ${handoffUrl}`);

  const copyButton = handoffUrl ? buildCopyButton(handoffUrl) : "";

  const codeRow = `
                    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td style="padding-right:${handoffUrl ? "12px" : "0"};vertical-align:middle;">
                          <span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.42em;padding-left:0.42em;color:${COLORS.text};font-variant-numeric:tabular-nums;user-select:all;-webkit-user-select:all;">
                            ${code}
                          </span>
                        </td>
                        ${handoffUrl ? `<td style="vertical-align:middle;">${copyButton}</td>` : ""}
                      </tr>
                    </table>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>Código de acceso — The Forge</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.pageBg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Tu código de acceso a The Forge: ${code}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.pageBg};padding:32px 16px 44px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:20px;background:${COLORS.cardBg};border:1px solid ${COLORS.cardBorder};overflow:hidden;box-shadow:0 10px 40px -18px rgba(74,44,28,0.18),0 2px 8px rgba(74,44,28,0.06);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,transparent,${COLORS.primary},#d48962,transparent);"></td>
          </tr>
          <tr>
            <td style="padding:34px 28px 30px;font-family:'Outfit','Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
              <div style="text-align:center;">
                ${LOGO_BLOCK}
                <p style="margin:0;font-size:24px;font-weight:700;color:${COLORS.text};letter-spacing:-0.03em;">The Forge</p>
                <p style="display:inline-block;margin:12px 0 0;padding:6px 14px;border-radius:999px;border:1px solid #dfc4b3;font-size:12px;font-weight:600;color:${COLORS.primary};letter-spacing:0.02em;">
                  Acceso sin contraseña
                </p>
              </div>

              <p style="margin:28px 0 8px;font-size:15px;color:${COLORS.text};line-height:1.55;">Hola,</p>
              <p style="margin:0 0 24px;font-size:15px;color:${COLORS.muted};line-height:1.6;">
                Usa este código de un solo uso para iniciar sesión en <strong style="color:${COLORS.text};font-weight:600;">The Forge</strong>.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.codeBg};border:1px solid ${COLORS.codeBorder};border-radius:16px;">
                <tr>
                  <td style="padding:22px 18px 20px;text-align:center;">
                    <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.muted};">Tu código</p>
                    ${codeRow}
                    <p style="margin:14px 0 0;font-size:12px;color:${COLORS.muted};line-height:1.5;">
                      ${
                        handoffUrl
                          ? "Pulsa «copiar» junto al código, luego pégalo en el login de The Forge."
                          : "Selecciona y copia los 6 dígitos, luego pégalos en la pantalla de inicio de sesión."
                      }
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0;font-size:14px;color:${COLORS.muted};line-height:1.6;text-align:center;">
                Caduca en <strong style="color:${COLORS.text};">10 minutos</strong>. Si no solicitaste este acceso, ignora este mensaje.
              </p>

              <hr style="border:none;border-top:1px solid ${COLORS.cardBorder};margin:28px 0 18px;"/>
              <p style="margin:0;font-size:12px;color:${COLORS.footer};line-height:1.5;text-align:center;">
                The Forge · Proyecto de código abierto · Apache License 2.0
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `Código de acceso — The Forge (${code})`,
    text: textLines.join("\n"),
    html: html.trim(),
  };
}
