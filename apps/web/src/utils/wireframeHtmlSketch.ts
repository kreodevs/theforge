import { COMPONENT_PREVIEW_BASE_CSS } from "./wireframePreviewStyles";
import {
  parseCell,
  parseWireframeAscii,
  zonesByAlign,
  type WireframeCell,
  type WireframeRow,
} from "./wireframeLayoutZones";

export { parseWireframeAscii } from "./wireframeLayoutZones";
export type { WireframeCell, WireframeRow } from "./wireframeLayoutZones";

/**
 * Genera un preview HTML real (divs, tablas, botones) a partir del wireframe ASCII
 * y la tabla de componentes DS, alineado con CU/HU/spec.
 */

export interface DsComponentRef {
  requiredComponent: string;
  dsModule: string;
  exportName: string;
  props: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  if (/input|email|contraseña|password/i.test(text)) tags.push("input");
  return tags;
}

function inferTableTitle(cell: WireframeCell): string {
  return cell.raw
    .replace(/\(DataTable\)/gi, "")
    .replace(/\(Modal\)/gi, "")
    .trim() || "Tabla";
}

function sampleTableRows(requirementsContext: string, isSelected: boolean): Array<Record<string, string>> {
  const fromAc = requirementsContext.match(/^-\s+(.+)$/gm)?.map((l) => l.replace(/^-\s+/, "").trim()) ?? [];
  if (fromAc.length >= 2) {
    return fromAc.slice(0, 4).map((label, i) => ({
      medio: label.slice(0, 48),
      canal: isSelected ? "En cotización" : "Disponible",
      precio: `$${(1200 + i * 340).toLocaleString("es-MX")}`,
    }));
  }
  if (isSelected) {
    return [
      { medio: "Spot TV 30s", canal: "Prime time", precio: "$12,400" },
      { medio: "Banner web", canal: "Home", precio: "$3,200" },
    ];
  }
  return [
    { medio: "TV Nacional", canal: "Abierta", precio: "$8,500" },
    { medio: "Radio FM", canal: "Matutino", precio: "$2,100" },
    { medio: "Digital Display", canal: "Programático", precio: "$4,750" },
  ];
}

function renderMockTable(cell: WireframeCell, requirementsContext: string, isSelected: boolean): string {
  const title = escapeHtml(inferTableTitle(cell));
  const rows = sampleTableRows(requirementsContext, isSelected);
  const body = rows
    .map(
      (r) =>
        `<tr class="border-b border-neutral-100 hover:bg-neutral-50">
          <td class="px-3 py-2">${escapeHtml(r.medio)}</td>
          <td class="px-3 py-2 text-neutral-500">${escapeHtml(r.canal)}</td>
          <td class="px-3 py-2 text-right font-medium">${escapeHtml(r.precio)}</td>
        </tr>`,
    )
    .join("");
  return `
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div class="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">${title}</div>
      <div class="min-h-0 flex-1 overflow-auto">
        <table class="w-full text-left text-sm">
          <thead class="sticky top-0 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th class="px-3 py-2 font-medium">Medio</th>
              <th class="px-3 py-2 font-medium">Canal</th>
              <th class="px-3 py-2 text-right font-medium">Precio</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

function renderButton(label: string, variant: "primary" | "secondary" | "ghost" = "secondary"): string {
  const cls =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : variant === "ghost"
        ? "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
        : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50";
  return `<button type="button" class="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm ${cls}">${escapeHtml(label)}</button>`;
}

function renderHeaderCell(cell: WireframeCell, requirementsContext: string): string {
  const menuBtns = cell.buttons.filter((b) => /menu/i.test(b));
  const userBtn = cell.buttons.find((b) => /usuario|perfil|user/i.test(b));
  return `<div class="flex w-full items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="flex h-8 w-20 items-center justify-center rounded bg-neutral-200 text-xs font-bold text-neutral-600">LOGO</div>
      ${menuBtns.map((b) => renderButton(b, "ghost")).join("")}
    </div>
    ${userBtn ? renderCellHtml({ raw: userBtn, buttons: [], tags: ["user"] }, requirementsContext, false) : ""}
  </div>`;
}

function renderCellHtml(cell: WireframeCell, requirementsContext: string, isRightTable: boolean): string {
  if (/logo/i.test(cell.raw) && cell.buttons.length > 0) {
    return renderHeaderCell(cell, requirementsContext);
  }

  if (cell.tags.includes("price") && cell.buttons.length > 0) {
    const priceMatch = cell.raw.match(/\$\s*[\d\s.,]+/);
    const price = priceMatch?.[0]?.trim() ?? "$0.00";
    return `<div class="flex w-full flex-wrap items-center justify-between gap-3">
      <p class="text-base font-semibold text-neutral-900">Precio total: <span class="tabular-nums">${escapeHtml(price)}</span></p>
      <div class="flex flex-wrap gap-2">${cell.buttons
        .map((b) => renderButton(b, /guardar|calcular/i.test(b) ? "primary" : "ghost"))
        .join("")}</div>
    </div>`;
  }

  if (cell.tags.includes("datatable") || /datatable|tabla de medios/i.test(cell.raw)) {
    return renderMockTable(cell, requirementsContext, isRightTable || /seleccionados/i.test(cell.raw));
  }

  if (cell.tags.includes("select") || cell.tags.includes("modal")) {
    const label = cell.raw.replace(/\(Modal\)/gi, "").replace(/\[ v \]/gi, "").trim();
    return `
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-neutral-700">${escapeHtml(label || "Seleccionar")}</span>
        <select class="h-9 w-full max-w-md rounded-md border border-neutral-300 bg-white px-3 text-sm shadow-sm">
          <option>Tarifario Q2 2026</option>
          <option>Tarifario Q1 2026</option>
        </select>
      </label>`;
  }

  if (cell.tags.includes("logo")) {
    return `<div class="flex h-8 w-24 items-center justify-center rounded bg-neutral-200 text-xs font-bold text-neutral-600">LOGO</div>`;
  }

  if (cell.tags.includes("user")) {
    return `<div class="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-neutral-700">
      <span class="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-300 text-[10px] font-semibold">U</span>
      Usuario
    </div>`;
  }

  if (cell.tags.includes("price")) {
    const priceMatch = cell.raw.match(/\$\s*[\d\s.,]+/);
    const price = priceMatch?.[0]?.trim() ?? "$0.00";
    return `<p class="text-base font-semibold text-neutral-900">Precio total: <span class="tabular-nums">${escapeHtml(price)}</span></p>`;
  }

  if (cell.tags.includes("input") || /input|email|contraseña/i.test(cell.raw)) {
    const isPass = /contraseña|password/i.test(cell.raw);
    return `
      <label class="flex w-full max-w-sm flex-col gap-1 text-sm">
        <span class="font-medium text-neutral-700">${escapeHtml(isPass ? "Password" : "Email")}</span>
        <input type="${isPass ? "password" : "email"}" class="h-9 rounded-md border border-neutral-300 px-3 text-sm shadow-sm" placeholder="${isPass ? "" : "m@example.com"}" />
      </label>`;
  }

  if (cell.buttons.length > 0) {
    return `<div class="flex flex-wrap items-center gap-2">${cell.buttons
      .map((b) => {
        const v = /guardar|login|iniciar|calcular|enviar/i.test(b) ? "primary" : "ghost";
        return renderButton(b, v);
      })
      .join("")}</div>`;
  }

  if (cell.raw) {
    return `<p class="text-sm text-neutral-600">${escapeHtml(cell.raw)}</p>`;
  }
  return "";
}

function renderZoneGroup(
  zones: { align: string; cell: WireframeCell }[],
  requirementsContext: string,
  isRightTable: boolean,
): string {
  return zones.map((z) => renderCellHtml(z.cell, requirementsContext, isRightTable)).join("");
}

function renderRow(row: WireframeRow, requirementsContext: string): string {
  const { left, center, right } = zonesByAlign(row.zones);

  switch (row.kind) {
    case "header":
      return `<header class="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3">
        <div class="flex min-w-0 flex-1 items-center gap-3">${renderZoneGroup([...left, ...center], requirementsContext, false)}</div>
        <div class="flex shrink-0 items-center gap-3">${renderZoneGroup(right, requirementsContext, false)}</div>
      </header>`;
    case "toolbar":
      return `<div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2">${renderZoneGroup([...left, ...center], requirementsContext, false)}</div>
        <div class="flex flex-wrap items-center gap-2">${renderZoneGroup(right, requirementsContext, false)}</div>
      </div>`;
    case "split":
      return `<div class="grid min-h-0 flex-1 grid-cols-1 gap-3 p-4 md:grid-cols-2">
        ${row.zones
          .map((z, i) =>
            renderCellHtml(
              z.cell,
              requirementsContext,
              z.align === "right" || i === 1 || /seleccionados/i.test(z.cell.raw),
            ),
          )
          .join("")}
      </div>`;
    case "footer":
      return `<footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/80 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2">${renderZoneGroup(left, requirementsContext, false)}</div>
        <div class="flex flex-wrap items-center gap-2">${renderZoneGroup([...center, ...right], requirementsContext, false)}</div>
      </footer>`;
    default:
      return `<div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div class="flex flex-wrap items-center gap-2">${renderZoneGroup([...left, ...center], requirementsContext, false)}</div>
        <div class="flex flex-wrap items-center gap-2">${renderZoneGroup(right, requirementsContext, false)}</div>
      </div>`;
  }
}

function buildFromDsComponents(
  dsComponents: DsComponentRef[],
  requirementsContext: string,
  screenTitle: string,
): string {
  const blocks = dsComponents.map((c) => {
    const cell = parseCell(c.requiredComponent);
    if (
      cell.tags.includes("datatable") ||
      /table|datatable/i.test(`${c.requiredComponent} ${c.dsModule}`)
    ) {
      return renderMockTable(cell, requirementsContext, /seleccionados/i.test(c.requiredComponent));
    }
    if (/button|botón/i.test(c.requiredComponent)) {
      return renderButton(c.requiredComponent.replace(/button|botón/gi, "").trim() || "Acción", "primary");
    }
    if (cell.tags.includes("input") || /input|field/i.test(c.requiredComponent)) {
      return renderCellHtml(cell, requirementsContext, false);
    }
    return `<div class="rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-sm text-neutral-600">
      <span class="font-medium">${escapeHtml(c.requiredComponent)}</span>
      <span class="text-neutral-400"> · ${escapeHtml(c.dsModule || "DS")}</span>
    </div>`;
  });
  return `
    <div class="flex min-h-[320px] flex-col rounded-lg border border-neutral-200 bg-white">
      <div class="border-b px-4 py-3 text-sm font-semibold">${escapeHtml(screenTitle)}</div>
      <div class="flex flex-col gap-3 p-4">${blocks.join("")}</div>
    </div>`;
}

export function buildWireframeHtmlSketchSrcDoc(options: {
  screenTitle: string;
  wireframeAscii?: string;
  dsComponents?: DsComponentRef[];
  requirementsContext?: string;
  description?: string;
}): string {
  const { screenTitle, wireframeAscii, dsComponents = [], requirementsContext = "" } = options;
  const rows = wireframeAscii?.trim() ? parseWireframeAscii(wireframeAscii) : [];

  let bodyInner: string;
  if (rows.length > 0) {
    bodyInner = `
      <div class="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        ${rows.map((r) => renderRow(r, requirementsContext)).join("\n")}
      </div>`;
  } else if (dsComponents.length > 0) {
    bodyInner = buildFromDsComponents(dsComponents, requirementsContext, screenTitle);
  } else {
    bodyInner = `<p class="p-4 text-sm text-neutral-500">Sin wireframe ni componentes DS para generar preview.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      color: #171717;
      -webkit-font-smoothing: antialiased;
    }
    #app { min-height: 100%; padding: 8px; }
    ${COMPONENT_PREVIEW_BASE_CSS}
  </style>
</head>
<body>
  <div id="app">${bodyInner}</div>
</body>
</html>`;
}
