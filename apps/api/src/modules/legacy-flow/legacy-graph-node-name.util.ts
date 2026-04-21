/**
 * Infiere un nombre de nodo/símbolo plausible para herramientas de grafo MCP
 * (`validate_before_edit`, `get_legacy_impact`) a partir del texto de
 * `get_functions_in_file` y la ruta del archivo.
 */

const RESERVED_PASCAL = new Set([
  "String",
  "Number",
  "Boolean",
  "Object",
  "Array",
  "Date",
  "RegExp",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Promise",
  "Error",
  "TypeError",
  "Symbol",
  "BigInt",
  "JSON",
  "Math",
  "Intl",
  "React",
  "Component",
  "FC",
  "JSX",
  "Element",
  "Fragment",
  "StrictMode",
  "Suspense",
]);

function filePathStem(filePath: string): string {
  const base = filePath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  return base || filePath;
}

/** `user-profile` → `UserProfile`; conserva un token ya PascalCase. */
function stemToPascalCandidates(stem: string): string[] {
  const clean = stem.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) return [];
  const parts = clean.split(/[-_]+/).filter(Boolean);
  if (parts.length === 0) return [];
  const pascal = parts.map((p) => p[0]!.toUpperCase() + p.slice(1)).join("");
  const out: string[] = [];
  if (pascal) out.push(pascal);
  if (/^[A-Z]/.test(stem)) out.push(stem);
  return out;
}

function collectPascalExports(text: string): string[] {
  const found: string[] = [];
  const reExport =
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = reExport.exec(text)) !== null) {
    const name = m[1];
    if (name && /^[A-Z]/.test(name)) found.push(name);
  }
  const reDefault = /export\s+default\s+([A-Za-z_$][\w$]*)/g;
  while ((m = reDefault.exec(text)) !== null) {
    const name = m[1];
    if (name && /^[A-Z]/.test(name)) found.push(name);
  }
  return found;
}

function collectPascalFromMarkdown(text: string): string[] {
  const found: string[] = [];
  for (const mm of text.matchAll(/\*\*([A-Z][A-Za-z0-9]*)\*\*/g)) {
    if (mm[1]) found.push(mm[1]);
  }
  for (const mm of text.matchAll(/`([A-Z][A-Za-z0-9]*)`/g)) {
    if (mm[1]) found.push(mm[1]);
  }
  return found;
}

function filterCandidates(names: string[]): string[] {
  return names.filter((n) => n.length >= 2 && !RESERVED_PASCAL.has(n));
}

/**
 * @param functionsMcpText - Salida markdown/texto de `get_functions_in_file`.
 * @param filePath - Ruta del archivo (para stem y heurística kebab→Pascal).
 */
export function inferLegacyGraphNodeNameFromFunctionsFileText(functionsMcpText: string, filePath: string): string {
  const stem = filePathStem(filePath);
  const text = (functionsMcpText ?? "").trim();
  if (!text) return stem;

  const candidates = filterCandidates([...collectPascalExports(text), ...collectPascalFromMarkdown(text)]);

  const stemCandidates = stemToPascalCandidates(stem);
  for (const sc of stemCandidates) {
    if (text.includes(sc)) {
      if (candidates.includes(sc)) return sc;
      return sc;
    }
  }
  for (const sc of stemCandidates) {
    const hit = candidates.find((c) => c === sc);
    if (hit) return hit;
  }
  if (candidates.length > 0) return candidates[0]!;
  return stem;
}
