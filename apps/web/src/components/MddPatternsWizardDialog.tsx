/**
 * Wizard de patrones de desarrollo (SSOT): primera generación o edición sin regenerar el MDD.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  applyPatternSelectionsToWizardBody,
  buildMddWithGovernanceSkeleton,
  listGovernancePatternOptions,
  MDD_GOVERNANCE_WIZARD_BODY,
  selectedPatternIdsFromMdd,
  updateMddGovernancePatterns,
} from "@theforge/shared-types/mdd-governance-patterns";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export type MddPatternsWizardMode = "initial" | "edit";

export interface MddPatternsWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: MddPatternsWizardMode;
  /** MDD actual (preselección de [X] y, en modo edit, documento a fusionar). */
  initialMddContent?: string | null;
  loading?: boolean;
  onConfirm: (markdown: string) => void | Promise<void>;
}

export function MddPatternsWizardDialog({
  open,
  onOpenChange,
  mode = "initial",
  initialMddContent,
  loading = false,
  onConfirm,
}: MddPatternsWizardDialogProps) {
  const options = useMemo(() => listGovernancePatternOptions(), []);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof options>();
    for (const o of options) {
      const list = map.get(o.group) ?? [];
      list.push(o);
      map.set(o.group, list);
    }
    return [...map.entries()];
  }, [options]);

  const [selected, setSelected] = useState<Set<string>>(() =>
    selectedPatternIdsFromMdd(initialMddContent ?? ""),
  );

  useEffect(() => {
    if (open) {
      setSelected(selectedPatternIdsFromMdd(initialMddContent ?? ""));
    }
  }, [open, initialMddContent]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    const body = applyPatternSelectionsToWizardBody(MDD_GOVERNANCE_WIZARD_BODY, selected);
    const markdown =
      mode === "edit"
        ? updateMddGovernancePatterns((initialMddContent ?? "").trim(), selected)
        : buildMddWithGovernanceSkeleton("Master Design Document", body);
    await onConfirm(markdown);
  }, [mode, onConfirm, selected, initialMddContent]);

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>
            {isEdit ? "Editar patrones de desarrollo (SSOT)" : "Patrones de desarrollo (SSOT)"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? (
              <>
                Solo se actualiza la sección <strong>[ARQUITECTURA - SECCIÓN INMUTABLE]</strong>. Las
                secciones §1–§7 del MDD no se regeneran.
              </>
            ) : (
              <>
                Marca los patrones que gobernarán el MDD y todos los entregables (Spec, Arq, API, Flujos,
                Tasks, Infra). Esta sección queda <strong>inmutable</strong> en el documento; al regenerar el
                MDD se conserva.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6 min-h-0">
          {grouped.map(([group, items]) => (
            <section key={group}>
              <h3 className="text-sm font-semibold text-foreground mb-2">{group}</h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <label
                      className={cn(
                        "flex gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/40",
                        selected.has(item.id) && "border-primary/50 bg-primary/5",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                      <span className="text-sm leading-snug">
                        <span className="font-medium">{item.label}</span>
                        {item.description ? (
                          <span className="text-muted-foreground"> — {item.description}</span>
                        ) : null}
                        {item.affects ? (
                          <span className="block text-xs text-muted-foreground mt-1">
                            Afecta a: {item.affects}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <DialogFooter className="px-6 py-4 shrink-0 border-t border-border/60">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : isEdit ? (
              "Guardar patrones"
            ) : (
              "Continuar y generar MDD"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
