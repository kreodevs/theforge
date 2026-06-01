import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  buildComponentPreviewPropsLiteral,
  orderPreviewComponentsByDsTable,
} from "@/utils/wireframeScreenPreview";
import {
  parseWireframeAscii,
  zonesByAlign,
  type WireframeCell,
  type WireframeRow,
  type ZonedCell,
} from "@/utils/wireframeLayoutZones";

export interface HostedPreviewComponent {
  name: string;
  moduleId: string;
  previewKind?: "html" | "url" | "unavailable" | "error" | "legacy";
  document?: string;
  previewUrl?: string;
  recommendedHeight?: number;
  sandbox?: string;
  snippet?: string;
  error?: string;
}

interface DsMapping {
  requiredComponent: string;
  dsModule: string;
  exportName: string;
  props: string;
}

function previewQuality(comp: HostedPreviewComponent): number {
  if (comp.error && comp.previewKind !== "unavailable") return 0;
  if (comp.previewKind === "html" && comp.document?.trim()) return 3;
  if (comp.previewKind === "url" && comp.previewUrl?.trim()) return 2;
  if (comp.snippet?.trim()) return 1;
  return 0;
}

export function hasHostedPreview(comp: HostedPreviewComponent): boolean {
  return previewQuality(comp) > 0;
}

export function hasStyledHostedPreview(comp: HostedPreviewComponent): boolean {
  return previewQuality(comp) >= 2;
}

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ");
}

function tokensMatch(a: string, b: string): boolean {
  const ta = normalizeToken(a);
  const tb = normalizeToken(b);
  if (!ta || !tb) return false;
  return ta.includes(tb) || tb.includes(ta);
}

function findPreviewForCell(
  cell: WireframeCell,
  ordered: HostedPreviewComponent[],
  dsComponents: DsMapping[],
  used: Set<string>,
): HostedPreviewComponent | undefined {
  const cellText = `${cell.raw} ${cell.buttons.join(" ")}`.toLowerCase();

  const pickBest = (candidates: HostedPreviewComponent[]) =>
    [...candidates].sort((a, b) => previewQuality(b) - previewQuality(a))[0];

  for (const comp of ordered) {
    if (used.has(comp.name) || !hasHostedPreview(comp)) continue;
    if (tokensMatch(cellText, comp.name)) return comp;
    const ds = dsComponents.find(
      (d) => d.requiredComponent.toLowerCase() === comp.name.toLowerCase(),
    );
    if (ds && tokensMatch(cellText, `${ds.requiredComponent} ${ds.dsModule} ${ds.exportName}`)) {
      return comp;
    }
  }

  const pickByKind = (pred: (name: string, ds?: DsMapping) => boolean) => {
    const matches: HostedPreviewComponent[] = [];
    for (const comp of ordered) {
      if (used.has(comp.name) || !hasHostedPreview(comp)) continue;
      const ds = dsComponents.find(
        (d) => d.requiredComponent.toLowerCase() === comp.name.toLowerCase(),
      );
      const hay = `${comp.name} ${comp.moduleId} ${ds?.dsModule ?? ""} ${ds?.exportName ?? ""}`;
      if (pred(hay.toLowerCase(), ds)) matches.push(comp);
    }
    return matches.length > 0 ? pickBest(matches) : undefined;
  };

  if (cell.tags.includes("user") || /usuario|avatar|perfil/i.test(cellText)) {
    const userComp = pickByKind((h) => /avatar|user|perfil/i.test(h));
    if (userComp) return userComp;
  }
  if (/menu/i.test(cellText) && !/usuario/i.test(cellText)) {
    const menuComp = pickByKind((h) => /menu|nav|navbar/i.test(h));
    if (menuComp) return menuComp;
  }
  if (cell.tags.includes("logo") || /^logo$/i.test(cell.raw.trim())) {
    return undefined;
  }

  if (cell.tags.includes("datatable") || /tabla|datatable|medios/i.test(cellText)) {
    const found = pickByKind((h) => /table|datatable|data-table|grid/i.test(h));
    if (found) return found;
  }
  if (cell.tags.includes("select") || /select|tarifario|dropdown/i.test(cellText)) {
    const found = pickByKind((h) => /select|dropdown|combobox/i.test(h));
    if (found) return found;
  }
  if (cell.tags.includes("input") || /email|correo|contraseña|password|input/i.test(cellText)) {
    const found = pickByKind((h) => /input|textfield|field/i.test(h));
    if (found) return found;
  }
  if (cell.buttons.length > 0 || cell.tags.includes("price")) {
    const label = cell.buttons[0] ?? "";
    if (/link|volver|enlace/i.test(cellText)) {
      const found = pickByKind((h) => /link|anchor/i.test(h));
      if (found) return found;
    }
    const found = pickByKind(
      (h) =>
        /button|btn/i.test(h) ||
        (label ? tokensMatch(h, label) : false),
    );
    if (found) return found;
  }

  const remaining = ordered.filter((c) => !used.has(c.name) && hasHostedPreview(c));
  return remaining.length > 0 ? pickBest(remaining) : undefined;
}

function findDsProps(dsComponents: DsMapping[], compName: string): string | undefined {
  return dsComponents.find(
    (d) => d.requiredComponent.toLowerCase() === compName.toLowerCase(),
  )?.props;
}

export interface WireframeComponentPreviewProps {
  screenTitle: string;
  description?: string;
  wireframeAscii?: string;
  dsComponents: DsMapping[];
  previewComponents: HostedPreviewComponent[];
  requirementsContext: string;
  renderPreview: (
    comp: HostedPreviewComponent,
    propsLiteral: string,
    className?: string,
  ) => ReactNode;
  className?: string;
}

function PreviewSlot({
  comp,
  screenTitle,
  description,
  requirementsContext,
  dsComponents,
  screenCtx,
  renderPreview,
  className,
}: {
  comp: HostedPreviewComponent;
  screenTitle: string;
  description?: string;
  requirementsContext: string;
  dsComponents: DsMapping[];
  screenCtx: { inputIndex?: number; buttonIndex?: number };
  renderPreview: WireframeComponentPreviewProps["renderPreview"];
  className?: string;
}) {
  const propsLiteral = buildComponentPreviewPropsLiteral(
    comp.name,
    findDsProps(dsComponents, comp.name),
    requirementsContext,
    comp.snippet ?? "",
    {
      title: screenTitle,
      description,
      inputIndex: screenCtx.inputIndex,
      buttonIndex: screenCtx.buttonIndex,
    },
  );
  return (
    <div className={cn("min-h-0 w-full", className)}>
      {renderPreview(comp, propsLiteral)}
    </div>
  );
}

function PreviewWireframeRow({
  row,
  ordered,
  dsComponents,
  screenTitle,
  description,
  requirementsContext,
  renderPreview,
  used,
  inputIdxRef,
  buttonIdxRef,
}: {
  row: WireframeRow;
  ordered: HostedPreviewComponent[];
  dsComponents: DsMapping[];
  screenTitle: string;
  description?: string;
  requirementsContext: string;
  renderPreview: WireframeComponentPreviewProps["renderPreview"];
  used: Set<string>;
  inputIdxRef: { current: number };
  buttonIdxRef: { current: number };
}) {
  const slotForCell = (cell: WireframeCell, className?: string) => {
    const comp = findPreviewForCell(cell, ordered, dsComponents, used);
    if (!comp) return null;
    used.add(comp.name);
    const lower = comp.name.toLowerCase();
    const ctx = {
      inputIndex: /input|field/i.test(lower) ? inputIdxRef.current++ : undefined,
      buttonIndex: /button|botón|link/i.test(lower) ? buttonIdxRef.current++ : undefined,
    };
    return (
      <PreviewSlot
        key={`${row.kind}-${comp.name}-${used.size}`}
        comp={comp}
        screenTitle={screenTitle}
        description={description}
        requirementsContext={requirementsContext}
        dsComponents={dsComponents}
        screenCtx={ctx}
        renderPreview={renderPreview}
        className={className}
      />
    );
  };

  const renderZones = (zones: ZonedCell[], className?: string) =>
    zones.map((z) => (
      <div key={`${row.kind}-${z.align}-${z.cell.raw}`} className={className}>
        {slotForCell(z.cell)}
      </div>
    ));

  const { left, center, right } = zonesByAlign(row.zones);

  switch (row.kind) {
    case "header":
      return (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            {renderZones([...left, ...center])}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {renderZones(right)}
          </div>
        </header>
      );
    case "toolbar":
      return (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">{renderZones([...left, ...center])}</div>
          <div className="flex flex-wrap items-center gap-2">{renderZones(right)}</div>
        </div>
      );
    case "split":
      return (
        <div className="grid min-h-[200px] flex-1 grid-cols-1 gap-3 p-4 md:grid-cols-2">
          {row.zones.map((z) => (
            <div key={`split-${z.align}-${z.cell.raw}`} className="min-h-[180px]">
              {slotForCell(z.cell)}
            </div>
          ))}
        </div>
      );
    case "footer":
      return (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">{renderZones(left)}</div>
          <div className="flex flex-wrap items-center gap-2">{renderZones([...center, ...right])}</div>
        </footer>
      );
    default:
      return (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">{renderZones([...left, ...center])}</div>
          <div className="flex flex-wrap items-center gap-2">{renderZones(right)}</div>
        </div>
      );
  }
}

export function WireframeComponentPreview({
  screenTitle,
  description,
  wireframeAscii,
  dsComponents,
  previewComponents,
  requirementsContext,
  renderPreview,
  className,
}: WireframeComponentPreviewProps) {
  const ordered = useMemo(
    () => orderPreviewComponentsByDsTable(previewComponents, dsComponents),
    [previewComponents, dsComponents],
  );

  const hostedPreviewCount = ordered.filter(hasHostedPreview).length;

  const layout = useMemo(() => {
    if (hostedPreviewCount === 0) return null;
    const rows = wireframeAscii?.trim() ? parseWireframeAscii(wireframeAscii) : [];
    const used = new Set<string>();
    const inputIdxRef = { current: 0 };
    const buttonIdxRef = { current: 0 };

    if (rows.length > 0) {
      return (
        <div className="flex min-h-[280px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {rows.map((row, i) => (
            <PreviewWireframeRow
              key={`row-${i}-${row.kind}`}
              row={row}
              ordered={ordered}
              dsComponents={dsComponents}
              screenTitle={screenTitle}
              description={description}
              requirementsContext={requirementsContext}
              renderPreview={renderPreview}
              used={used}
              inputIdxRef={inputIdxRef}
              buttonIdxRef={buttonIdxRef}
            />
          ))}
          {ordered
            .filter((c) => !used.has(c.name) && hasHostedPreview(c))
            .map((comp) => {
              used.add(comp.name);
              const lower = comp.name.toLowerCase();
              return (
                <div key={`extra-${comp.name}`} className="border-t border-neutral-100 px-4 py-2">
                  <PreviewSlot
                    comp={comp}
                    screenTitle={screenTitle}
                    description={description}
                    requirementsContext={requirementsContext}
                    dsComponents={dsComponents}
                    screenCtx={{
                      inputIndex: /input|field/i.test(lower) ? inputIdxRef.current++ : undefined,
                      buttonIndex: /button|botón/i.test(lower) ? buttonIdxRef.current++ : undefined,
                    }}
                    renderPreview={renderPreview}
                  />
                </div>
              );
            })}
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6">
        {ordered.filter(hasHostedPreview).map((comp) => {
          const lower = comp.name.toLowerCase();
          return (
            <PreviewSlot
              key={comp.name}
              comp={comp}
              screenTitle={screenTitle}
              description={description}
              requirementsContext={requirementsContext}
              dsComponents={dsComponents}
              screenCtx={{
                inputIndex: /input|field/i.test(lower) ? inputIdxRef.current++ : undefined,
                buttonIndex: /button|botón|link/i.test(lower) ? buttonIdxRef.current++ : undefined,
              }}
              renderPreview={renderPreview}
            />
          );
        })}
      </div>
    );
  }, [
    hostedPreviewCount,
    wireframeAscii,
    ordered,
    dsComponents,
    screenTitle,
    description,
    requirementsContext,
    renderPreview,
  ]);

  if (!layout) return null;

  return (
    <div className={className}>
      {layout}
      <p className="mt-2 text-center text-[10px] text-neutral-400">
        Componentes (MCP) · {hostedPreviewCount} componente{hostedPreviewCount === 1 ? "" : "s"}
        {ordered.filter(hasStyledHostedPreview).length > 0
          ? ` · ${ordered.filter(hasStyledHostedPreview).length} con preview HTML del DS`
          : " · snippets con estilos base"}
      </p>
    </div>
  );
}
