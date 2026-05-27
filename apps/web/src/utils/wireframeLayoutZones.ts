/**
 * Interpreta posición horizontal en líneas ASCII del wireframe (izq / centro / der).
 */

export interface WireframeCell {
  raw: string;
  buttons: string[];
  tags: string[];
}

export type HorizontalAlign = "left" | "center" | "right";

export interface ZonedCell {
  align: HorizontalAlign;
  cell: WireframeCell;
}

export type WireframeRowKind = "header" | "toolbar" | "split" | "footer" | "content";

export interface WireframeRow {
  cells: WireframeCell[];
  zones: ZonedCell[];
  kind: WireframeRowKind;
}

function extractButtons(text: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const label = m[1].trim();
    if (label && label !== "v" && label.length < 40) out.push(label);
  }
  return out;
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  if (/\(DataTable\)|datatable|tabla de/i.test(text)) tags.push("datatable");
  if (/\(Modal\)|modal/i.test(text)) tags.push("modal");
  if (/select|tarifario|\[ v \]/i.test(text)) tags.push("select");
  if (/logo/i.test(text)) tags.push("logo");
  if (/usuario|avatar|perfil/i.test(text)) tags.push("user");
  if (/precio total|total:/i.test(text)) tags.push("price");
  if (/input|email|contraseña|password|buscar/i.test(text)) tags.push("input");
  return tags;
}

export function parseCell(raw: string): WireframeCell {
  const cleaned = raw
    .replace(/[┌┐└┘├┤─═]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    raw: cleaned,
    buttons: extractButtons(cleaned),
    tags: extractTags(cleaned),
  };
}

/** Extrae contenido útil de una línea con bordes │ */
function lineInnerContent(line: string): string {
  const pipeParts = line
    .split(/[│|]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^[-─━═]+$/.test(p));
  if (pipeParts.length >= 2) {
    return pipeParts.join("   ");
  }
  return line
    .replace(/^[│|├┤┌┐└┘─═\s]+/, "")
    .replace(/[│|├┤┌┐└┘─═\s]+$/, "")
    .trim();
}

/**
 * Divide una línea ASCII en zonas con alineación según columnas │, huecos o posición de tokens.
 */
export function splitLineIntoZones(line: string): ZonedCell[] {
  const pipeParts = line
    .split(/[│|]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^[-─━═]+$/.test(p));

  if (pipeParts.length >= 2) {
    return pipeParts.map((part, i) => ({
      align:
        i === 0
          ? "left"
          : i === pipeParts.length - 1 && pipeParts.length > 2
            ? "right"
            : i === pipeParts.length - 1
              ? "right"
              : "center",
      cell: parseCell(part),
    }));
  }

  const inner = lineInnerContent(line);
  if (!inner) return [];

  const gapSegments = inner.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (gapSegments.length >= 2) {
    return gapSegments.map((seg, i) => ({
      align:
        i === 0 ? "left" : i === gapSegments.length - 1 ? "right" : "center",
      cell: parseCell(seg),
    }));
  }

  const rightMarkers = [
    /\[?\s*usuario\s*\]?/i,
    /\[?\s*avatar\s*\]?/i,
    /\[?\s*perfil\s*\]?/i,
    /\[?\s*cerrar\s*sesi[oó]n\s*\]?/i,
  ];
  for (const re of rightMarkers) {
    const m = inner.match(re);
    if (m?.index != null && m.index > inner.length * 0.38) {
      const left = inner.slice(0, m.index).trim();
      const right = inner.slice(m.index).trim();
      const zones: ZonedCell[] = [];
      if (left) zones.push({ align: "left", cell: parseCell(left) });
      if (right) zones.push({ align: "right", cell: parseCell(right) });
      if (zones.length > 0) return zones;
    }
  }

  const priceMatch = inner.match(/precio total/i);
  if (priceMatch?.index != null && priceMatch.index > 0) {
    const left = inner.slice(0, priceMatch.index).trim();
    const right = inner.slice(priceMatch.index).trim();
    return [
      { align: "left", cell: parseCell(left) },
      { align: "right", cell: parseCell(right) },
    ];
  }

  return [{ align: "left", cell: parseCell(inner) }];
}

export function classifyRow(zones: ZonedCell[]): WireframeRowKind {
  const cells = zones.map((z) => z.cell);
  const joined = cells.map((c) => c.raw).join(" ").toLowerCase();

  if (
    zones.length >= 2 &&
    cells.every((c) => c.tags.includes("datatable") || /tabla|medios/i.test(c.raw))
  ) {
    return "split";
  }

  if (
    joined.includes("logo") ||
    joined.includes("menu") ||
    joined.includes("usuario") ||
    (zones.some((z) => z.align === "right") && /usuario|avatar|perfil/i.test(joined))
  ) {
    if (/precio total|calcular|guardar|añadir|reset/i.test(joined) && cells.some((c) => c.buttons.length > 0)) {
      return "footer";
    }
    if (zones.some((z) => z.align === "right") && /usuario|avatar/i.test(joined)) {
      return "header";
    }
    if (joined.includes("logo") || joined.includes("menu")) {
      return "header";
    }
  }

  if (/precio total|calcular|guardar|añadir medio|reset/i.test(joined) && cells.some((c) => c.buttons.length > 0)) {
    return "footer";
  }

  if (cells.length === 1 && (cells[0].tags.includes("select") || cells[0].tags.includes("modal"))) {
    return "toolbar";
  }

  if (cells.some((c) => c.buttons.length >= 2) && /buscar|crear|exportar|tarifario/i.test(joined)) {
    return "toolbar";
  }

  return "content";
}

export function parseWireframeAscii(ascii: string): WireframeRow[] {
  const rows: WireframeRow[] = [];
  for (const line of ascii.split("\n")) {
    if (!/[│|]/.test(line)) continue;
    const zones = splitLineIntoZones(line);
    if (zones.length === 0) continue;
    const cells = zones.map((z) => z.cell);
    const allBox = cells.every((c) => /^[\s\-─━═┌┐└┘├┤│]+$/.test(c.raw));
    if (allBox || cells.every((c) => !c.raw)) continue;
    rows.push({ cells, zones, kind: classifyRow(zones) });
  }
  return rows;
}

export function zonesByAlign(zones: ZonedCell[]): {
  left: ZonedCell[];
  center: ZonedCell[];
  right: ZonedCell[];
} {
  const left: ZonedCell[] = [];
  const center: ZonedCell[] = [];
  const right: ZonedCell[] = [];
  for (const z of zones) {
    if (z.align === "right") right.push(z);
    else if (z.align === "center") center.push(z);
    else left.push(z);
  }
  return { left, center, right };
}
