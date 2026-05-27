/** Estilos base tipo Shadcn/Orbita para previews en iframe (snippets legacy sin CSS embebido). */
export const ORBITA_PREVIEW_BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #0a0a0a;
    -webkit-font-smoothing: antialiased;
  }
  label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #0a0a0a; }
  input, select, textarea {
    display: block; width: 100%; max-width: 100%;
    height: 2.25rem; padding: 0.25rem 0.75rem;
    font-size: 14px; line-height: 1.5;
    border: 1px solid #e5e5e5; border-radius: 0.375rem;
    background: #fff; color: #0a0a0a;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  input:focus, select:focus, textarea:focus {
    outline: none; border-color: #a3a3a3; box-shadow: 0 0 0 2px rgba(0,0,0,0.06);
  }
  button, [role="button"] {
    display: inline-flex; align-items: center; justify-content: center;
    height: 2.25rem; padding: 0 1rem;
    font-size: 14px; font-weight: 500;
    border-radius: 0.375rem; border: 1px solid transparent;
    cursor: pointer; white-space: nowrap;
  }
  button[type="submit"], button.primary, .btn-primary {
    background: #171717; color: #fafafa;
  }
  button:not([type="submit"]):not(.primary):not(.btn-primary) {
    background: #fff; color: #171717; border-color: #e5e5e5;
  }
  a { color: #171717; text-decoration: underline; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { border: 1px solid #e5e5e5; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; font-size: 12px; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .gap-2 { gap: 0.5rem; }
  .gap-4 { gap: 1rem; }
  .w-full { width: 100%; }
  .max-w-md { max-width: 28rem; }
  .mx-auto { margin-left: auto; margin-right: auto; }
  .p-4, .p-6 { padding: 1rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .text-sm { font-size: 14px; }
  .font-semibold { font-weight: 600; }
`.trim();

/** Asegura documento HTML completo para srcDoc (hosted Orbita o fragmentos). */
export function ensureFullHtmlDocument(html: string, injectBaseCss = false): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;

  const hasDoctype = /^\s*<!doctype/i.test(trimmed);
  const hasHtml = /<html[\s>]/i.test(trimmed);

  if (hasDoctype || hasHtml) {
    if (!injectBaseCss) return trimmed;
    if (/<style[\s>]/i.test(trimmed) || /<link[^>]+stylesheet/i.test(trimmed)) {
      return trimmed;
    }
    return trimmed.replace(/<head([^>]*)>/i, `<head$1><style>${ORBITA_PREVIEW_BASE_CSS}</style>`);
  }

  const cssBlock = injectBaseCss ? `<style>${ORBITA_PREVIEW_BASE_CSS}</style>` : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  ${cssBlock}
</head>
<body>${trimmed}</body>
</html>`;
}
