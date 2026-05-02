/**
 * Extractor dedicado de tokens de diseño desde el codebase.
 * 
 * Dos fases:
 * 1. Búsqueda de archivos (tailwind.config.*, *.css con custom props, tokens.*)
 * 2. Parseo y extracción estructurada de tokens reales
 *
 * Se integra en el flujo legacy previo a la generación de Guía UX/UI.
 */

interface DesignTokenFindings {
  foundTailwind: boolean;
  foundCssCustomProps: boolean;
  foundThemeFile: boolean;
  tailwindConfigSample: string;
  cssCustomPropsSample: string;
  themeSample: string;
  structuredTailwind: Record<string, string>;  // colores extraídos como {primary: "#1A1C1E"}
  structuredCSS: Record<string, string>;        // custom props como {colorPrimary: "#1A1C1E"}
  summary: string;
}

// ---------------------------------------------------------------------------
// Fase 1: Localizar archivos de diseño en el codebase
// ---------------------------------------------------------------------------

/**
 * Busca archivos de diseño específicos usando consultas dirigidas a Ariadne.
 */
async function locateDesignFiles(
  fileSearch: (glob: string) => Promise<string[]>,
): Promise<{
  tailwindFiles: string[];
  cssFiles: string[];
  tokenFiles: string[];
}> {
  const [tailwinds, csses, tokens] = await Promise.all([
    fileSearch("tailwind.config.*").catch(() => []),
    fileSearch("*.css").catch(() => []),
    fileSearch("{tokens,theme,design-tokens}.{json,js,ts}").catch(() => []),
  ]);
  return {
    tailwindFiles: tailwinds,
    cssFiles: csses,
    tokenFiles: tokens,
  };
}

// ---------------------------------------------------------------------------
// Fase 2: Parseo de tokens extraídos
// ---------------------------------------------------------------------------

/** Intenta parsear valores de Tailwind config a partir de texto crudo. */
function parseTailwindTokens(raw: string): Record<string, string> {
  const tokens: Record<string, string> = {};

  // Buscar colors: { ... } en Tailwind config
  const colorBlock = raw.match(/colors\s*:\s*\{([^}]+)\}/);
  if (colorBlock) {
    const colorLines = colorBlock[1].split(",");
    for (const line of colorLines) {
      const kv = line.match(/['"]?(\w+(?:-\w+)*)['"]?\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/);
      if (kv) tokens[`color_${kv[1]}`] = kv[2];
    }
  }

  // Buscar fontFamily
  const fontMatch = raw.match(/fontFamily\s*:\s*\{([^}]+)\}/);
  if (fontMatch) {
    const families = fontMatch[1].match(/['"]?(\w+(?:-\w+)*)['"]?\s*:/g);
    if (families) families.forEach((f) => {
      const name = f.replace(/['":]/g, "").trim();
      if (name) tokens[`font_${name}`] = name;
    });
  }

  // Buscar valores hex individuales (colores)
  const hexColors = raw.match(/#[0-9a-fA-F]{6}\b/g);
  if (hexColors) {
    hexColors.forEach((h, i) => {
      if (!Object.values(tokens).includes(h)) {
        tokens[`hex_${i}`] = h;
      }
    });
  }

  return tokens;
}

/** Parsea CSS custom properties de texto crudo. */
function parseCssCustomProps(raw: string): Record<string, string> {
  const tokens: Record<string, string> = {};

  // Buscar :root { ... } o [data-theme] { ... }
  const rootBlock = raw.match(/:root\s*\{([^}]+)\}/);
  const themeBlock = raw.match(/\[data-theme[^\]]*\]\s*\{([^}]+)\}/);

  const blocks = [rootBlock?.[1], themeBlock?.[1]].filter(Boolean);
  for (const block of blocks) {
    const propLines = block!.split(";");
    for (const line of propLines) {
      const kv = line.match(/--([\w-]+)\s*:\s*([^;]+)/);
      if (kv) {
        const key = kv[1].trim();
        const val = kv[2].trim();
        if (val.startsWith("#") || val.startsWith("rgb")) {
          tokens[`css_${key}`] = val;
        }
      }
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Fase 3: ask_codebase enriquecido para hallazgos
// ---------------------------------------------------------------------------

/**
 * Extractor principal: usa ask_codebase + búsqueda de archivos para encontrar
 * y extraer tokens de diseño reales del codebase.
 */
export async function extractDesignTokensFromTheForgeContext(
  askCodebase: (query: string) => Promise<string>,
  // fileSearch y getFileContent son opcionales — si no se proveen, solo usa ask_codebase
  fileSearch?: (glob: string) => Promise<string[]>,
  getFileContent?: (path: string) => Promise<string>,
): Promise<DesignTokenFindings> {
  // --- Fase A: Búsqueda de archivos (si tenemos acceso a archivos) ---
  let tailwindContent = "";
  let cssContent = "";
  let tokenContent = "";

  if (fileSearch && getFileContent) {
    const files = await locateDesignFiles(fileSearch);

    // Leer tailwind config
    for (const f of files.tailwindFiles) {
      try {
        tailwindContent += `\n--- ${f} ---\n${await getFileContent(f)}\n`;
      } catch { /* skip */ }
    }

    // Leer CSS buscando :root con custom props
    for (const f of files.cssFiles) {
      try {
        const content = await getFileContent(f);
        if (/:root\s*\{|--color-|--font-/.test(content)) {
          cssContent += `\n--- ${f} ---\n${content}\n`;
        }
      } catch { /* skip */ }
    }

    // Leer archivos de tokens
    for (const f of files.tokenFiles) {
      try {
        tokenContent += `\n--- ${f} ---\n${await getFileContent(f)}\n`;
      } catch { /* skip */ }
    }
  }

  // --- Fase B: ask_codebase (siempre disponible) ---
  const queries = [
    {
      key: "tailwind" as const,
      query: `Busca en el codebase archivos de configuración de Tailwind CSS (tailwind.config.*) o archivos que definan la paleta de colores, tipografía y espaciado del frontend. Si encuentras, extrae el theme (colors, fontFamily, spacing, borderRadius, etc.) tal cual del config. Responde solo con el contenido relevante, sin comentarios. Si no hay, responde "NO_TAILWIND".`,
    },
    {
      key: "css" as const,
      query: `Busca en el codebase archivos CSS con custom properties (--color-*, --font-*, --spacing-*, --radius-*) o variables de diseño. Extrae las definiciones completas de las custom properties relacionadas con diseño visual (colores, tipografía, sombras, bordes, spacing). Responde solo con las definiciones encontradas. Si no hay, responde "NO_CSS_PROPS".`,
    },
    {
      key: "theme" as const,
      query: `Busca en el codebase archivos de tema, tokens de diseño, tokens.json, theme.json, o cualquier archivo que defina valores de diseño estructurados (colores, fuentes, tamaños). Extrae el contenido relevante. Si no hay, responde "NO_THEME".`,
    },
    {
      key: "tailwindFiles" as const,
      query: `Lista las rutas de todos los archivos llamados tailwind.config.* en el codebase. Responde SOLO con las rutas, una por línea. Si no hay, responde "NO_FILES".`,
    },
  ];

  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        return { key: q.key, result: await askCodebase(q.query) };
      } catch {
        return { key: q.key, result: "" };
      }
    }),
  );

  const byKey = Object.fromEntries(results.map((r) => [r.key, r.result]));

  // Combinar resultados de fileSearch + ask_codebase
  const twFromAsk = byKey.tailwind ?? "";
  const cssFromAsk = byKey.css ?? "";
  const themeFromAsk = byKey.theme ?? "";

  const tailwindRaw = [tailwindContent, twFromAsk].filter(Boolean).join("\n\n");
  const cssRaw = [cssContent, cssFromAsk].filter(Boolean).join("\n\n");
  const themeRaw = [tokenContent, themeFromAsk].filter(Boolean).join("\n\n");

  const foundTailwind = tailwindRaw.length > 20 && !tailwindRaw.includes("NO_TAILWIND");
  const foundCssCustomProps = cssRaw.length > 20 && !cssRaw.includes("NO_CSS_PROPS");
  const foundThemeFile = themeRaw.length > 20 && !themeRaw.includes("NO_THEME");

  // Parseo estructurado
  const structuredTailwind = foundTailwind ? parseTailwindTokens(tailwindRaw) : {};
  const structuredCSS = foundCssCustomProps ? parseCssCustomProps(cssRaw) : {};

  const trunc = (s: string, max = 4000) => (s.length > max ? s.slice(0, max) + "\n… (truncado)" : s);

  const parts: string[] = [];
  if (foundTailwind) {
    parts.push("=== Tailwind Config Tokens ===\n" + trunc(tailwindRaw));
    if (Object.keys(structuredTailwind).length > 0) {
      parts.push("=== Tokens parseados ===\n" +
        Object.entries(structuredTailwind).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
    }
  }
  if (foundCssCustomProps) {
    parts.push("=== CSS Custom Properties ===\n" + trunc(cssRaw));
    if (Object.keys(structuredCSS).length > 0) {
      parts.push("=== Custom Props parseadas ===\n" +
        Object.entries(structuredCSS).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
    }
  }
  if (foundThemeFile) {
    parts.push("=== Theme / Token Files ===\n" + trunc(themeRaw));
  }

  const summary = parts.length > 0
    ? parts.join("\n\n")
    : "[El codebase no expone tokens de diseño detectables (Tailwind config, CSS custom props ni archivos de tema). La guía UX/UI se basará en el MDD, el contexto general del código y las mejores prácticas del dominio.]";

  return {
    foundTailwind,
    foundCssCustomProps,
    foundThemeFile,
    tailwindConfigSample: foundTailwind ? trunc(tailwindRaw) : "",
    cssCustomPropsSample: foundCssCustomProps ? trunc(cssRaw) : "",
    themeSample: foundThemeFile ? trunc(themeRaw) : "",
    structuredTailwind,
    structuredCSS,
    summary,
  };
}

/**
 * Formatea los hallazgos como contexto para inyectar en el prompt de Guía UX/UI.
 */
export function formatDesignTokensForUxGuide(findings: DesignTokenFindings): string {
  if (!findings.foundTailwind && !findings.foundCssCustomProps && !findings.foundThemeFile) {
    return "";
  }

  let block = "## Tokens de Diseño Extraídos del Codebase\n\n";
  block += "Estos son tokens reales encontrados en el código existente. La Guía UX/UI debe priorizar esta información sobre valores por defecto:\n\n";
  block += findings.summary;

  // Si hay tokens estructurados, generar YAML sugerido
  const allStructured = { ...findings.structuredTailwind, ...findings.structuredCSS };
  if (Object.keys(allStructured).length > 0) {
    block += "\n\n### Tokens estructurados sugeridos para DESIGN.md\n\n```yaml\n";
    block += "colors:\n";
    for (const [k, v] of Object.entries(allStructured)) {
      if (k.startsWith("color_") || k.startsWith("css_")) {
        const name = k.replace(/^(color|css)_/, "");
        block += `  ${name}: "${v}"\n`;
      }
    }
    block += "```\n";
  }

  block += "\n\n**Instrucción:** Al generar los tokens YAML del DESIGN.md, usa estos valores reales del codebase como base. Si hay conflicto entre el MDD y los tokens extraídos, prioriza los tokens extraídos (son lo que realmente existe en el código).";

  return block;
}
