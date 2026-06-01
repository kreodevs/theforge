import { COMPONENT_PREVIEW_BASE_CSS } from "./wireframePreviewStyles";

/** Mirrors API parseProductionSnippetText — unwrap MCP JSON envelopes in the iframe. */
export function parseProductionSnippetText(
  text: string,
  moduleIdHint?: string,
): { code: string; error?: string } {
  const trimmed = text.trim();
  const label = moduleIdHint ?? "módulo";

  if (!trimmed) {
    return { code: "", error: `Sin snippet para ${label}` };
  }

  if (!trimmed.startsWith("{")) {
    return { code: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    if (typeof parsed.error === "string") {
      return { code: "", error: parsed.error };
    }

    if (parsed.standalone === false) {
      const msg =
        typeof parsed.message === "string"
          ? parsed.message
          : `Sin plantilla standalone para ${String(parsed.moduleId ?? label)}`;
      return { code: "", error: msg };
    }

    if (typeof parsed.snippet === "string" && parsed.snippet.trim()) {
      return { code: parsed.snippet.trim() };
    }

    if (typeof parsed.code === "string" && parsed.code.trim()) {
      return { code: parsed.code.trim() };
    }

    return { code: "", error: `Respuesta MCP sin código ejecutable para ${label}` };
  } catch {
    return { code: trimmed };
  }
}

/** React UMD globals in iframe — snippets keep bare `useState` etc. */
const REACT_GLOBAL_PRELUDE = `
const React = window.React;
const { useState, useEffect, useRef, useMemo, useCallback } = React;
`.trim();

/** Drop ESM imports; prelude supplies hooks from window.React. */
export function stripImportsForPreview(code: string): string {
  return code
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^\s*(const|let|var)\s+\w+\s*=\s*require\([^)]+\);?\s*$/gm, "")
    .trim();
}

/** Babel may emit require('react') — map to UMD globals. */
export function patchCompiledForUmdReact(compiled: string): string {
  return compiled
    .replace(
      /\bvar\s+(\w+)\s*=\s*_interopRequire(?:Default|Wildcard)?\(\s*require\(["']react(?:\/jsx-runtime)?["']\)\s*\)/g,
      "var $1 = window.React",
    )
    .replace(/\brequire\(["']react(?:\/jsx-runtime)?["']\)/g, "window.React")
    .replace(/\bimport\s+[\s\S]*?from\s+["']react[^"']*["'];?\s*/g, "");
}

/** Injected into iframe srcdoc — keep in sync with patchCompiledForUmdReact. */
const PATCH_COMPILED_FOR_UMD_REACT_FN = String.raw`function patchCompiledForUmdReact(compiled) {
  return compiled
    .replace(/\bvar\s+(\w+)\s*=\s*_interopRequire(?:Default|Wildcard)?\(\s*require\(["']react(?:\/jsx-runtime)?["']\)\s*\)/g, 'var $1 = window.React')
    .replace(/\brequire\(["']react(?:\/jsx-runtime)?["']\)/g, 'window.React')
    .replace(/\bimport\s+[\s\S]*?from\s+["']react[^"']*["'];?\s*/g, '');
}`;

const DEMO_ITEM = "{ id: '1', title: 'Sección 1', label: 'Opción 1', content: 'Preview', value: '1' }";
const DEMO_ITEM_2 = "{ id: '2', title: 'Sección 2', label: 'Opción 2', content: 'Preview 2', value: '2' }";

/** Infer mock props from component source (destructuring, .map, etc.). */
export function inferPreviewPropsFromSource(source: string, compName: string): string | null {
  const lower = compName.toLowerCase();
  const usesItemsMap = /\bitems\b/.test(source) && /\bitems\s*\.map\b/.test(source);
  const usesSectionsMap = /\bsections\b/.test(source) && /\bsections\s*\.map\b/.test(source);
  const usesOptionsMap = /\boptions\b/.test(source) && /\boptions\s*\.map\b/.test(source);
  const usesColumnsMap = /\bcolumns\b/.test(source) && /\bcolumns\s*\.map\b/.test(source);
  const usesDataMap = /\bdata\b/.test(source) && /\bdata\s*\.map\b/.test(source);
  const usesTabsMap = /\btabs\b/.test(source) && /\btabs\s*\.map\b/.test(source);
  const usesRowsMap = /\brows\b/.test(source) && /\brows\s*\.map\b/.test(source);

  if (lower.includes("accordion") || usesItemsMap || usesSectionsMap) {
    if (usesSectionsMap) {
      return `{ sections: [${DEMO_ITEM}, ${DEMO_ITEM_2}] }`;
    }
    return `{ items: [${DEMO_ITEM}, ${DEMO_ITEM_2}] }`;
  }

  if (
    lower.includes("table") ||
    lower.includes("datatable") ||
    usesColumnsMap ||
    (usesDataMap && /\bcolumns\b/.test(source))
  ) {
    return `{
      columns: [{ key: 'name', header: 'Nombre' }, { key: 'status', header: 'Estado' }],
      data: [{ name: 'Preview', status: 'Activo' }, { name: 'Ejemplo', status: 'Pendiente' }],
      rows: [{ name: 'Preview', status: 'Activo' }]
    }`;
  }

  if (
    lower.includes("dropdown") ||
    lower.includes("select") ||
    usesOptionsMap
  ) {
    return `{ options: [${DEMO_ITEM}, ${DEMO_ITEM_2}], value: '1', onChange: function(){} }`;
  }

  if (lower.includes("tab") || usesTabsMap) {
    return `{ tabs: [${DEMO_ITEM}, ${DEMO_ITEM_2}] }`;
  }

  if (lower.includes("list") || usesRowsMap) {
    return `{ items: [${DEMO_ITEM}, ${DEMO_ITEM_2}], rows: [${DEMO_ITEM}, ${DEMO_ITEM_2}] }`;
  }

  if (lower.includes("pagination")) {
    return `{ page: 1, pageSize: 10, total: 42, onPageChange: function(){} }`;
  }

  if (lower.includes("datepicker") || lower.includes("date")) {
    return `{ value: new Date(), onChange: function(){} }`;
  }

  if (lower.includes("switch") || lower.includes("checkbox") || lower.includes("radio")) {
    return `{ checked: true, onChange: function(){}, label: 'Preview' }`;
  }

  if (lower.includes("progress")) {
    return `{ value: 65, max: 100 }`;
  }

  if (lower.includes("chart")) {
    return `{ data: [{ label: 'A', value: 40 }, { label: 'B', value: 60 }] }`;
  }

  if (lower.includes("breadcrumb")) {
    return `{ items: [{ label: 'Inicio', href: '#' }, { label: 'Preview', href: '#' }] }`;
  }

  if (/\bchildren\b/.test(source) && !usesItemsMap && !usesOptionsMap) {
    return null;
  }

  if (usesItemsMap) {
    return `{ items: [${DEMO_ITEM}, ${DEMO_ITEM_2}] }`;
  }
  if (usesOptionsMap) {
    return `{ options: [${DEMO_ITEM}, ${DEMO_ITEM_2}] }`;
  }

  return null;
}

export function previewPropsForComponent(compName: string, source = ""): string {
  const inferred = source ? inferPreviewPropsFromSource(source, compName) : null;
  if (inferred) return inferred;

  const lower = compName.toLowerCase();
  if (lower.includes("modal") || lower.includes("overlay") || lower.includes("drawer")) {
    return "{ isOpen: true, open: true, onClose: function(){}, onOpenChange: function(){}, title: 'Preview', children: 'Preview' }";
  }
  if (lower.includes("alert")) {
    return "{ children: 'Preview', variant: 'info', title: 'Preview' }";
  }
  if (lower.includes("input") || lower.includes("field") || lower.includes("search")) {
    return "{ placeholder: 'Preview', value: '', onChange: function(){} }";
  }
  if (lower.includes("button")) {
    return "{ children: 'Preview' }";
  }
  if (lower.includes("badge") || lower.includes("tag")) {
    return "{ children: 'Preview' }";
  }
  if (lower.includes("spinner") || lower.includes("loader")) {
    return "{ size: 'md' }";
  }
  if (lower.includes("card")) {
    return "{ title: 'Preview', children: 'Preview' }";
  }
  if (lower.includes("text") || lower.includes("typography")) {
    return "{ children: 'Preview' }";
  }
  return "{ children: 'Preview' }";
}

export const PREVIEW_ERROR_BOUNDARY = `
class PreviewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error };
  }
  componentDidCatch(error) {
    this.setState({ error: error });
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: { color: '#b91c1c', fontSize: 12, padding: 8, whiteSpace: 'pre-wrap' }
      }, this.state.error.message || String(this.state.error));
    }
    return this.props.children;
  }
}
`.trim();

export interface PrepareSnippetOptions {
  /** JS object literal passed to React.createElement(Component, …) */
  propsLiteral?: string;
  componentName?: string;
}

/** Source for iframe: unwrap JSON, strip imports, add App wrapper (TS ok — Babel compiles). */
export function prepareSnippetForIframe(raw: string, options?: PrepareSnippetOptions): string {
  const { code, error } = parseProductionSnippetText(raw);
  if (error || !code.trim()) {
    return `${REACT_GLOBAL_PRELUDE}\n\nfunction App() {\n  return React.createElement('div', { style: { color: '#b91c1c', fontSize: 13 } }, ${JSON.stringify(error ?? "Sin código")});\n}`;
  }

  let source = stripImportsForPreview(code);
  source = source.replace(/^export\s+default\s+/gm, "").replace(/^export\s+/gm, "");

  let body = source;
  if (!/\bfunction\s+App\s*[({]/.test(body)) {
    const fnMatch = body.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*[({]/);
    const compName = options?.componentName ?? fnMatch?.[1];
    if (compName) {
      const props =
        options?.propsLiteral ?? previewPropsForComponent(compName, body);
      body = `${body}\n\n${PREVIEW_ERROR_BOUNDARY}\n\nfunction App() {\n  return React.createElement(PreviewErrorBoundary, null,\n    React.createElement(${compName}, ${props})\n  );\n}`;
    } else {
      body = `${body}\n\nfunction App() {\n  return React.createElement('div', null, 'Preview no disponible');\n}`;
    }
  }

  return `${REACT_GLOBAL_PRELUDE}\n\n${body}`;
}

export interface BuildSnippetSrcDocOptions {
  /** When true, iframe body is transparent so it blends into the screen sketch card. */
  transparentBg?: boolean;
}

/** Pinned UMD builds — jsDelivr evita ERR_HTTP2_PROTOCOL_ERROR frecuente en unpkg con muchos iframes. */
const REACT_UMD_URL =
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js";
const REACT_DOM_UMD_URL =
  "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js";
const BABEL_STANDALONE_URL =
  "https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.6/babel.min.js";

/** Build iframe HTML: compile TS/JSX with Babel then mount App. */
export function buildSnippetPreviewSrcDoc(
  preparedSource: string,
  options?: BuildSnippetSrcDocOptions,
): string {
  const bodyBg = options?.transparentBg ? "transparent" : "#fff";
  const bodyPadding = options?.transparentBg ? "8px 0" : "16px";
  const mountScript = `
function mountPreviewApp() {
  var rootEl = document.getElementById('root');
  if (!window.React || !window.ReactDOM) {
    throw new Error('React no cargó desde CDN (comprueba red o bloqueadores).');
  }
  var element = React.createElement(App);
  if (typeof ReactDOM.createRoot === 'function') {
    ReactDOM.createRoot(rootEl).render(element);
  } else if (typeof ReactDOM.render === 'function') {
    ReactDOM.render(element, rootEl);
  } else {
    throw new Error('ReactDOM.createRoot no disponible.');
  }
}
`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: ${bodyPadding}; background: ${bodyBg}; }
    #root-error { color: #b91c1c; font-size: 12px; white-space: pre-wrap; }
    ${COMPONENT_PREVIEW_BASE_CSS}
  </style>
</head>
<body>
  <div id="root"></div>
  <pre id="root-error" hidden></pre>
  <script>
    (function () {
      var REACT_URL = ${JSON.stringify(REACT_UMD_URL)};
      var REACT_DOM_URL = ${JSON.stringify(REACT_DOM_UMD_URL)};
      var BABEL_URL = ${JSON.stringify(BABEL_STANDALONE_URL)};
      var source = ${JSON.stringify(preparedSource)};

      function showError(msg) {
        var el = document.getElementById('root-error');
        el.hidden = false;
        el.textContent = msg;
      }

      function loadScript(url) {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = url;
          s.crossOrigin = 'anonymous';
          s.async = false;
          s.onload = function () { resolve(); };
          s.onerror = function () { reject(new Error('No se pudo cargar: ' + url)); };
          document.head.appendChild(s);
        });
      }

      loadScript(REACT_URL)
        .then(function () { return loadScript(REACT_DOM_URL); })
        .then(function () { return loadScript(BABEL_URL); })
        .then(function () {
          var compiled;
          try {
            compiled = Babel.transform(source, {
              filename: 'wireframe-snippet.tsx',
              sourceType: 'script',
              presets: [
                ['typescript', { isTSX: true, allExtensions: true }],
                ['react', { runtime: 'classic', pragma: 'React.createElement', pragmaFrag: 'React.Fragment' }],
              ],
            }).code;
            ${PATCH_COMPILED_FOR_UMD_REACT_FN}
            compiled = patchCompiledForUmdReact(compiled);
          } catch (err) {
            showError(err && err.message ? err.message : String(err));
            return;
          }
          var s = document.createElement('script');
          s.textContent = compiled + ${JSON.stringify(mountScript)} + '\\nmountPreviewApp();';
          document.body.appendChild(s);
        })
        .catch(function (err) {
          showError(err && err.message ? err.message : String(err));
        });
    })();
  <\/script>
</body>
</html>`;
}

export interface ComposedScreenItem {
  componentName: string;
  snippet: string;
  propsLiteral: string;
}

/** One iframe with all legacy snippets stacked — final screen sketch in a single white frame. */
export function buildComposedScreenPreviewSrcDoc(items: ComposedScreenItem[]): string | null {
  const sources: string[] = [];
  const renderCalls: string[] = [];
  let idx = 0;

  for (const item of items) {
    const { code, error } = parseProductionSnippetText(item.snippet, item.componentName);
    if (error || !code.trim()) return null;

    let source = stripImportsForPreview(code);
    source = source.replace(/^export\s+default\s+/gm, "").replace(/^export\s+/gm, "");

    const fnMatch = source.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*[({]/);
    const compName = fnMatch?.[1];
    if (!compName) return null;

    const alias = `ScreenComp${idx}`;
    source = source.replace(
      new RegExp(`function\\s+${compName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`),
      `function ${alias} `,
    );
    sources.push(source);
    renderCalls.push(
      `React.createElement(PreviewErrorBoundary, { key: '${alias}' }, React.createElement(${alias}, ${item.propsLiteral}))`,
    );
    idx += 1;
  }

  if (renderCalls.length === 0) return null;

  const prepared = `${REACT_GLOBAL_PRELUDE}

${sources.join("\n\n")}

${PREVIEW_ERROR_BOUNDARY}

function App() {
  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 420, margin: '0 auto' } },
    ${renderCalls.join(",\n    ")}
  );
}`;

  return buildSnippetPreviewSrcDoc(prepared, { transparentBg: true });
}
