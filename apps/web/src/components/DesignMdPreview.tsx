import { useMemo } from "react";

// ─── Tipos compartidos ─────────────────────────────────────────

interface DesignTokens {
  name?: string;
  description?: string;
  colors?: Record<string, string>;
  typography?: Record<string, TypographyToken>;
  rounded?: Record<string, string>;
  spacing?: Record<string, string>;
  elevation?: Record<string, string>;
  components?: Record<string, ComponentToken>;
}

interface TypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: string;
}

interface ComponentToken {
  backgroundColor?: string;
  textColor?: string;
  rounded?: string;
  padding?: string | number;
  size?: string | number;
  height?: string | number;
  width?: string | number;
  typography?: string;
}

// ─── Google-style DESIGN.md parser ─────────────────────────────

function parseDesignMdContent(content: string): DesignTokens | null {
  const tokens: DesignTokens = {};

  // ── Colors ──────────────────────────────────────────────
  const colorsSection = extractSection(content, ["colors", "color"]);
  if (colorsSection) {
    const colors: Record<string, string> = {};
    // Pattern: "Primary (#HEX)" or "Primary: #HEX" or "--primary: #HEX"
    const colorPatterns = [
      /(?:^|\n)\s*(?:\*\*)?(\w[\w\s-]*?)(?:\*\*)?\s*[:(]\s*[#]?\(?([A-Fa-f0-9]{6})\)?/gm,
      /--[\w-]+:\s*[#]?\(?([A-Fa-f0-9]{6})\)?/g,
    ];
    for (const pattern of colorPatterns) {
      let m: RegExpExecArray | null;
      const re = new RegExp(pattern.source, 'gm');
      while ((m = re.exec(colorsSection)) !== null) {
        if (m[1] && m[2]) {
          const name = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          if (name) colors[name] = `#${m[2].toUpperCase()}`;
        }
      }
    }
    // Also look for CSS var comments: "Primary (#1A5F7A): Azul profundo."
    const cssColorRe = /(\w[\w\s]*?)\s*\((#([A-Fa-f0-9]{6}))\)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cssColorRe.exec(colorsSection)) !== null) {
      const name = cm[1]!.toLowerCase().trim().replace(/\s+/g, '-');
      const hex = cm[2]!.toUpperCase();
      if (name && !Object.values(colors).includes(hex)) {
        colors[name] = hex;
      }
    }
    if (Object.keys(colors).length > 0) tokens.colors = colors;
  }

  // ── Typography ──────────────────────────────────────────
  const typographySection = extractSection(content, ["typography", "type", "fonts", "font"]);
  if (typographySection) {
    const typography: Record<string, TypographyToken> = {};
    
    // Font family
    const ff = typographySection.match(/(?:font[-\s]?family|Inter|sans-serif)[^.]*(?:Inter|system-ui)/i);
    if (ff) {
      // Extract Inter reference
    }

    // Hierarchy: "h1 32px 700 40px -0.02em" or "h1: 32px / 700 / 40px / -0.02em"
    const hierRe = /(h1|h2|h3|h4|h5|h6|body[\s-]?md|body[\s-]?sm|body|label[\s-]?sm|label|small|caption|footnote)\s+(\d+)\s*px\s+(\d{3})\s+(\d+)\s*px\s*([\d.-]+)?\s*(?:em)?/gi;
    let hm: RegExpExecArray | null;
    while ((hm = hierRe.exec(typographySection)) !== null) {
      const key = hm[1]!.toLowerCase().replace(/[\s_]+/g, '-');
      typography[key] = {
        fontSize: `${hm[2]}px`,
        fontWeight: parseInt(hm[3]!),
        lineHeight: `${hm[4]}px`,
        letterSpacing: hm[5] ? `${hm[5]}em` : undefined,
      };
    }

    // Also handle "Token Tamaño Peso Leading Tracking" tables
    const tableRe = /\|?\s*(h1|h2|h3|h4|h5|h6|body[\s-]?md|body[\s-]?sm|label[\s-]?sm)\s*\|?\s*(\d+)\s*px?\s*\|?\s*(\d{3})\s*\|?\s*(\d+)\s*px?\s*\|?\s*([\d.-]+)?\s*(?:em)?/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tableRe.exec(typographySection)) !== null) {
      const key = tm[1]!.toLowerCase().replace(/[\s_]+/g, '-');
      typography[key] = {
        fontSize: `${tm[2]}px`,
        fontWeight: parseInt(tm[3]!),
        lineHeight: `${tm[4]}px`,
        letterSpacing: tm[5] ? `${tm[5]}em` : undefined,
      };
    }

    if (Object.keys(typography).length > 0) {
      typography['font-sans'] = { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" };
      tokens.typography = typography;
    }
  }

  // ── Layout / Spacing ────────────────────────────────────
  const layoutSection = extractSection(content, ["layout", "spacing"]);
  if (layoutSection) {
    const spacing: Record<string, string> = {};
    
    // Grid columns
    const gridRe = /(\d+)\s*columnas/i;
    const gm2 = gridRe.exec(layoutSection);
    if (gm2) spacing['grid-columns'] = gm2[1]!;

    // Spacing tokens
    const spRe = /(xs|sm|md|lg|xl|2xl|3xl)\s*[:(]\s*(\d+)\s*px/gi;
    let sm: RegExpExecArray | null;
    while ((sm = spRe.exec(layoutSection)) !== null) {
      spacing[sm[1]!.toLowerCase()] = `${sm[2]}px`;
    }

    if (Object.keys(spacing).length > 0) tokens.spacing = spacing;
  }

  // ── Elevation & Depth ───────────────────────────────────
  const elevationSection = extractSection(content, ["elevation", "depth", "shadow"]);
  if (elevationSection) {
    const elevation: Record<string, string> = {};
    
    // "Card: 0 1px 3px rgba(...)" or "Tarjetas (card): 0 1px 3px rgba(...)"
    const shRe = /(Card|Tarjeta|Modal|Panel|Dropdown|Tooltip|Sticky|Header|card|modal|dropdown|tooltip|sticky)[\s:(]+([\d\s,.pxrgba()a-zA-Z-]+?)(?:\n|$)/gi;
    let shm: RegExpExecArray | null;
    while ((shm = shRe.exec(elevationSection)) !== null) {
      const key = shm[1]!.toLowerCase();
      const val = shm[2]!.trim().replace(/\s+/g, ' ');
      if (val && val.includes('rgba')) {
        if (key.includes('card')) elevation['card'] = val;
        else if (key.includes('modal') || key.includes('panel')) elevation['modal'] = val;
        else if (key.includes('dropdown') || key.includes('tooltip')) elevation['dropdown'] = val;
        else if (key.includes('sticky') || key.includes('header')) elevation['sticky'] = val;
      }
    }

    if (Object.keys(elevation).length > 0) tokens.elevation = elevation;
  }

  // ── Shapes / Border Radius ─────────────────────────────
  const shapesSection = extractSection(content, ["shapes", "rounded", "border-radius", "border radius"]);
  if (shapesSection) {
    const rounded: Record<string, string> = {};
    
    // "sm (6px): Botones, inputs" or "sm: 6px"
    const rdRe = /(sm|md|lg|xl|full)\s*[:(]\s*(\d+)\s*px/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rdRe.exec(shapesSection)) !== null) {
      rounded[rm[1]!.toLowerCase()] = `${rm[2]}px`;
    }

    if (Object.keys(rounded).length > 0) tokens.rounded = rounded;
  }

  // ── Components ─────────────────────────────────────────
  const componentsSection = extractSection(content, ["components"]);
  if (componentsSection) {
    const components: Record<string, ComponentToken> = {};
    
    // Split by component name: a line that starts with a word that isn't a property
    // Common patterns:
    // "Button Primary" or "Button Primary:" on its own line
    // "### Button" or "### Button Primary" markdown heading
    // "Button\n-----" underline heading
    const compBlocks = componentsSection.split(/\n(?=(?:[A-Z]\w[\w\s]*?)(?:\n|:)|###?\s+)/);
    for (const block of compBlocks) {
      const nameMatch = block.match(/^(?:###?\s+)?([A-Z]\w[\w\s/]+?)(?:\s*:)?(?:\n|$)/m);
      if (!nameMatch) continue;
      const compName = nameMatch[1]!.trim().toLowerCase().replace(/[\s/]+/g, '-');
      if (['overview', 'colors', 'typography', 'layout', 'components', 'elevation', 'shapes', "do's", "don'ts", 'dos', 'donts', 'introduction'].includes(compName)) continue;
      
      const comp: ComponentToken = {};
      
      // Color / background
      const bgMatch = block.match(/(?:Color|Background|Fondo|Bg)[:\s]+(.+?)(?:\n|$)/i);
      if (bgMatch) {
        const val = bgMatch[1]!.trim();
        const hex = val.match(/#([A-Fa-f0-9]{6})/);
        if (hex) comp.backgroundColor = `#${hex[1]!.toUpperCase()}`;
        else if (val.includes('tertiary') || val.includes('amber') || val.includes('ámbar')) 
          comp.backgroundColor = '{colors.tertiary}' in components ? '#F4A261' : '#F4A261';
        else if (val.includes('primary') || val.includes('azul') || val.includes('blue'))
          comp.backgroundColor = '{colors.primary}' in components ? '#1A5F7A' : '#1A5F7A';
        else if (val.includes('secondary') || val.includes('verde') || val.includes('green'))
          comp.backgroundColor = '{colors.secondary}' in components ? '#2E8B57' : '#2E8B57';
        else if (val.includes('neutral') || val.includes('blanco') || val.includes('white') || val.includes('#FFF'))
          comp.backgroundColor = '#FFFFFF';
      }
      
      // Text color
      const fgMatch = block.match(/(?:Texto|Text|Color de texto)[:\s]+(.+?)(?:\n|$)/i);
      if (fgMatch) {
        const val = fgMatch[1]!.trim();
        if (val.includes('blanco') || val.includes('white') || val.includes('#FFF') || val.includes('#FFFFFF'))
          comp.textColor = '#FFFFFF';
        else if (val.includes('#') && val.match(/#([A-Fa-f0-9]{6})/))
          comp.textColor = `#${val.match(/#([A-Fa-f0-9]{6})/)![1]!.toUpperCase()}`;
        else comp.textColor = '#1A1C1E';
      }
      
      // Border radius
      const rdMatch = block.match(/(?:rounded|border radius|border-radius|redondeado)[.\s:]+(.+?)(?:\n|$)/i);
      if (rdMatch) {
        const val = rdMatch[1]!.trim();
        const px = val.match(/(\d+)\s*px/);
        if (px) comp.rounded = `${px[1]}px`;
        else if (val.includes('sm')) comp.rounded = '6px';
        else if (val.includes('md')) comp.rounded = '12px';
        else if (val.includes('lg')) comp.rounded = '20px';
      }
      
      // Padding
      const padMatch = block.match(/(?:Padding|pad)[:\s]+(.+?)(?:\n|$)/i);
      if (padMatch) {
        const val = padMatch[1]!.trim();
        const px = val.match(/(\d+)\s*px/);
        if (px) comp.padding = `${px[1]}px`;
      }
      
      // Only add if we extracted meaningful props
      if (comp.backgroundColor || comp.textColor || comp.rounded || comp.padding) {
        components[compName] = comp;
      }
    }

    if (Object.keys(components).length > 0) tokens.components = components;
  }

  return Object.keys(tokens).length > 0 ? tokens : null;
}

/** Extract a markdown section by heading name. Tries multiple heading formats. */
function extractSection(content: string, names: string[]): string | null {
  for (const name of names) {
    // Match ## Name, ### Name, **Name**, or standalone Name: section
    // Allows blank lines and non-heading content within the section
    const patterns = [
      new RegExp(`##+\\s*${escapeRegex(name)}[^\\n]*(?:\\n(?:[^#][^\\n]*|\\s*)?)*`, 'i'),
      new RegExp(`\\*\\*${escapeRegex(name)}\\*\\*[^\\n]*(?:\\n(?!##|\\*\\*)[^\\n]*)*`, 'i'),
    ];
    for (const pattern of patterns) {
      const m = pattern.exec(content);
      if (m) return m[0];
    }
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface DesignTokens {
  name?: string;
  description?: string;
  colors?: Record<string, string>;
  typography?: Record<string, TypographyToken>;
  rounded?: Record<string, string>;
  spacing?: Record<string, string>;
  components?: Record<string, ComponentToken>;
}

interface TypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: string;
}

interface ComponentToken {
  backgroundColor?: string;
  textColor?: string;
  rounded?: string;
  padding?: string | number;
  size?: string | number;
  height?: string | number;
  width?: string | number;
  typography?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function resolveRef(value: string, tokens: DesignTokens): string {
  const match = value.match(/^\{([\w.]+)\}$/);
  if (!match) return value;
  const parts = match[1]!.split(".");
  let obj: unknown = tokens;
  for (const part of parts) {
    if (obj && typeof obj === "object" && part in obj) {
      obj = (obj as Record<string, unknown>)[part];
    } else {
      return value;
    }
  }
  return typeof obj === "string" ? obj : value;
}

function parseYamlFrontMatter(content: string): { frontMatter: DesignTokens | null; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontMatter: null, body: content };

  const rawYaml: string = m[1] ?? "";
  const body: string = (m[2] ?? "").trim();
  const tokens: DesignTokens = {};

  let currentSection: string | null = null;

  const lines = rawYaml.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;

    // Section header (colors:, typography:, rounded:, spacing:, components:)
    const sec = t.match(/^(\w+):\s*$/);
    if (sec) {
      currentSection = sec[1]!;
      continue;
    }

    // Sub-key in typography (h1:, body-md:, etc.)
    if (currentSection === "typography") {
      const sub = t.match(/^(\S+):\s*$/);
      if (sub) {
        const sk = sub[1]!;
        if (!tokens.typography) tokens.typography = {};
        if (!tokens.typography[sk]) tokens.typography[sk] = {};
        continue;
      }
      // Key:value in typography
      const kv = t.match(/^(\w+):\s*["']?(.+?)["']?\s*$/);
      if (kv) {
        const k = kv[1]!;
        const v = kv[2]!.replace(/["']/g, "");
        // Find the last typography key (we don't track currentSubKey)
        const typoKeys = tokens.typography ? Object.keys(tokens.typography) : [];
        if (typoKeys.length > 0) {
          const lastKey: string = typoKeys[typoKeys.length - 1]!;
          if (!tokens.typography![lastKey]) tokens.typography![lastKey] = {};
          (tokens.typography![lastKey] as Record<string, string>)[k] = v;
        }
      }
      continue;
    }

    // Sub-key in components
    if (currentSection === "components") {
      const sub = t.match(/^(\S+):\s*$/);
      if (sub) {
        const sk = sub[1]!;
        if (!tokens.components) tokens.components = {};
        if (!tokens.components[sk]) tokens.components[sk] = {};
        continue;
      }
      // Key:value in components
      const kv = t.match(/^(\w+):\s*["']?(.+?)["']?\s*$/);
      if (kv) {
        const k = kv[1]!;
        const v = kv[2]!.replace(/["']/g, "");
        const compKeys = tokens.components ? Object.keys(tokens.components) : [];
        if (compKeys.length > 0) {
          const lastKey: string = compKeys[compKeys.length - 1]!;
          if (!tokens.components![lastKey]) tokens.components![lastKey] = {};
          (tokens.components![lastKey] as Record<string, string>)[k] = v;
        }
      }
      continue;
    }

    // Simple key-value sections (colors, rounded, spacing)
    if (currentSection && ["colors", "rounded", "spacing"].includes(currentSection)) {
      const kv = t.match(/^(\S+):\s*["']?(.+?)["']?\s*$/);
      if (kv) {
        const k = kv[1]!;
        const v = kv[2]!.replace(/["']/g, "");
        const s = tokens as Record<string, Record<string, string>>;
        if (!s[currentSection]) s[currentSection] = {};
        s[currentSection]![k] = v;
      }
      continue;
    }

    // Top-level fields (version, name, description)
    if (!currentSection) {
      const kv = t.match(/^(\w+):\s*["']?(.+?)["']?\s*$/);
      if (kv && kv[1] && ["name", "description", "version"].includes(kv[1])) {
        (tokens as Record<string, string>)[kv[1]] = kv[2]!.replace(/["']/g, "");
      }
    }
  }

  return { frontMatter: tokens, body };
}

function ColorSwatch({ name, hex, textColor }: { name: string; hex: string; textColor?: string }) {
  const bg = hex.startsWith("#") ? hex : `#${hex}`;
  const fg = textColor ?? (isLightColor(bg) ? "#1A1C1E" : "#FFFFFF");
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-3 min-w-[90px] min-h-[80px] gap-1 border border-zinc-600/30"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="text-[11px] font-medium capitalize">{name}</span>
      <span className="text-[10px] opacity-80 font-mono">{hex}</span>
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

function TypographySpec({
  label,
  token,
}: {
  label: string;
  token: TypographyToken;
}) {
  const style: Record<string, string> = {};
  if (token.fontFamily) style.fontFamily = token.fontFamily;
  if (token.fontSize) style.fontSize = token.fontSize;
  if (token.fontWeight) style.fontWeight = String(token.fontWeight);
  if (token.lineHeight) style.lineHeight = String(token.lineHeight);
  if (token.letterSpacing) style.letterSpacing = token.letterSpacing;

  return (
    <div className="flex items-start gap-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-600/30">
      <div className="min-w-[70px] shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-zinc-100 truncate" style={style}>
          The quick brown fox jumps over the lazy dog 123
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[10px] text-zinc-500 font-mono">
          {token.fontFamily && <span>{token.fontFamily}</span>}
          {token.fontSize && <span>{token.fontSize}</span>}
          {token.fontWeight && <span>w{token.fontWeight}</span>}
          {token.lineHeight && <span>lh {token.lineHeight}</span>}
          {token.letterSpacing && <span>{token.letterSpacing}</span>}
        </div>
      </div>
    </div>
  );
}

function SpacingScale({ tokens }: { tokens: Record<string, string> | undefined }) {
  if (!tokens || Object.keys(tokens).length === 0) return null;
  return (
    <div className="space-y-2">
      {Object.entries(tokens).map(([key, val]) => {
        const px = parseInt(val.replace("px", "").replace("rem", ""));
        const w = isNaN(px) ? 60 : Math.min(px * 4, 200);
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-8 shrink-0">{key}</span>
            <div className="h-4 rounded bg-amber-500/40" style={{ width: `${Math.max(w, 8)}px` }} />
            <span className="text-[10px] font-mono text-zinc-500">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

function ComponentPreview({
  name,
  token,
  tokens,
}: {
  name: string;
  token: ComponentToken;
  tokens: DesignTokens;
}) {
  const bg = token.backgroundColor ? resolveRef(token.backgroundColor, tokens) : "#3B82F6";
  const fg = token.textColor ? resolveRef(token.textColor, tokens) : "#FFFFFF";
  const radius = token.rounded ? resolveRef(token.rounded, tokens) : "8px";
  const pad = typeof token.padding === "number" ? `${token.padding}px` : (token.padding ?? "12px");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{name.replace(/-/g, " ")}</span>
      <div
        className="inline-flex items-center justify-center text-xs font-medium min-h-[32px]"
        style={{ backgroundColor: bg, color: fg, borderRadius: radius, padding: pad }}
      >
        {name.replace(/-/g, " ")}
      </div>
    </div>
  );
}

export function DesignMdPreview({ content }: { content: string }) {
  // Try YAML frontmatter first, then Google-style DESIGN.md
  const frontMatter = useMemo(() => {
    const yaml = parseYamlFrontMatter(content).frontMatter;
    if (yaml && (yaml.colors || yaml.typography || yaml.components)) return yaml;
    return parseDesignMdContent(content);
  }, [content]);

  // Extract name/description from markdown if not in tokens
  const title = useMemo(() => {
    if (frontMatter?.name) return frontMatter.name;
    const h1 = content.match(/^#\s+(.+)/m);
    return h1?.[1] ?? "Vista previa de diseño";
  }, [content, frontMatter]);

  const description = useMemo(() => {
    if (frontMatter?.description) return frontMatter.description;
    const overview = extractSection(content, ["overview", "introduction", "intro"]);
    if (overview) {
      const firstLine = overview.split("\n").slice(1).find(l => l.trim() && !l.startsWith("#"));
      return firstLine?.trim() ?? null;
    }
    return null;
  }, [content, frontMatter]);

  if (!frontMatter || (!frontMatter.colors && !frontMatter.typography && !frontMatter.components)) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-zinc-500 text-sm">
        No se encontraron tokens de diseño en formato DESIGN.md. Genera la Guía UX/UI para ver la vista previa visual.
      </div>
    );
  }

  const colors = frontMatter.colors;
  const typography = frontMatter.typography;
  const spacing = frontMatter.spacing;
  const rounded = frontMatter.rounded;
  const components = frontMatter.components;

  return (
    <div className="overflow-auto p-4 space-y-8">
      {title && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          {description && (
            <p className="text-sm text-zinc-400 mt-1">{description}</p>
          )}
        </div>
      )}

      {colors && Object.keys(colors).length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Colors</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(colors).map(([name, hex]) => (
              <ColorSwatch key={name} name={name} hex={hex} />
            ))}
          </div>
        </section>
      )}

      {typography && Object.keys(typography).length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Typography</h3>
          <div className="space-y-2">
            {Object.entries(typography).map(([key, val]) => (
              <TypographySpec key={key} label={key} token={val} />
            ))}
          </div>
        </section>
      )}

      {spacing && Object.keys(spacing).length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Spacing Scale</h3>
          <SpacingScale tokens={spacing} />
        </section>
      )}

      {rounded && Object.keys(rounded).length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Border Radius</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(rounded).map(([key, val]) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 bg-amber-500/30 border border-amber-500/50"
                  style={{ borderRadius: val }}
                />
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{key}</span>
                <span className="text-[9px] font-mono text-zinc-600">{val}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(() => {
        const el = frontMatter.elevation ?? (frontMatter as any).elevation;
        if (!el || Object.keys(el).length === 0) return null;
        return (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Elevation & Depth</h3>
            <div className="space-y-3">
              {Object.entries(el).map(([key, val]) => {
                const shadowValue = typeof val === 'string' ? val : String(val);
                return (
                  <div key={key} className="flex items-start gap-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-600/30">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-16 shrink-0">{key}</span>
                    <div className="flex-1">
                      <div
                        className="w-full h-12 rounded bg-zinc-900 flex items-center justify-center"
                        style={{ boxShadow: shadowValue }}
                      >
                        <span className="text-[10px] text-zinc-500 font-mono">{key}</span>
                      </div>
                      <div className="mt-1.5 text-[9px] font-mono text-zinc-600 break-all">{shadowValue}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {components && Object.keys(components).length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Components</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(components).map(([name, token]) => (
              <ComponentPreview key={name} name={name} token={token} tokens={frontMatter} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function extractDesignMdFrontMatter(content: string): DesignTokens | null {
  return parseYamlFrontMatter(content).frontMatter;
}
