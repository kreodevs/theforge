import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "./ui";
import { fetchProviderInstanceCatalogModels, updateProviderInstance } from "@/lib/provider-instances-api";
import {
  PROVIDER_TIER_META,
  TIER_MODEL_FIELD,
  type ProviderModelTier,
} from "@/utils/provider-tier-labels";
import type { ProviderInstanceSummary } from "@/types/user-providers";
import { cn } from "@/lib/utils";

export interface ProviderTierModelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: ProviderInstanceSummary | null;
  tier: ProviderModelTier | null;
  onSaved: (updated: ProviderInstanceSummary) => void;
}

export function ProviderTierModelModal({
  open,
  onOpenChange,
  instance,
  tier,
  onSaved,
}: ProviderTierModelModalProps) {
  const [modelValue, setModelValue] = useState("");
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = tier ? PROVIDER_TIER_META[tier] : null;
  const field = tier ? TIER_MODEL_FIELD[tier] : null;

  const uniqueOptions = useMemo(() => [...new Set(chatModels.filter(Boolean))], [chatModels]);

  useEffect(() => {
    if (!open || !instance || !field) return;
    setError("");
    setModelValue(instance[field] ?? "");
    let cancelled = false;
    setLoadingCatalog(true);
    void fetchProviderInstanceCatalogModels(instance.providerType)
      .then((catalog) => {
        if (cancelled) return;
        setChatModels(catalog.chatModels);
      })
      .catch((err) => {
        if (cancelled) return;
        setChatModels([]);
        setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo");
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, instance?.id, instance?.providerType, field]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!instance || !field || !tier) return;
    const trimmed = modelValue.trim();
    if (tier === "ligero" && !trimmed) {
      setError("El modelo Ligero es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const patch =
        tier === "ligero"
          ? { chatModel: trimmed }
          : tier === "estandar"
            ? { graphChatModel: trimmed || null }
            : { architectChatModel: trimmed || null };
      const updated = await updateProviderInstance(instance.id, patch);
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el modelo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="sm:max-w-md">
        <form onSubmit={(e) => void handleSave(e)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {meta ? `Modelo ${meta.label}` : "Modelo del tier"}
            </DialogTitle>
            <DialogDescription>
              {instance
                ? `Actualiza solo el modelo ${meta?.label ?? ""} de «${instance.displayName}».`
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {error ? (
              <p
                className="rounded-md border border-[color-mix(in_oklch,var(--destructive)_42%,var(--border))] bg-[color-mix(in_oklch,var(--destructive)_10%,var(--card))] px-3 py-2 text-sm text-[var(--destructive)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <label
                htmlFor="tier-model-value"
                className="block text-sm font-medium text-[var(--foreground)]"
              >
                ID del modelo
                {tier === "ligero" ? (
                  <span className="text-[var(--destructive)]"> *</span>
                ) : null}
              </label>
              {loadingCatalog ? (
                <div className="flex items-center gap-2 py-2 text-sm text-[var(--foreground-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Cargando catálogo…
                </div>
              ) : uniqueOptions.length > 0 ? (
                <select
                  id="tier-model-value"
                  className="flex h-9 w-full rounded-md border border-[var(--input-border)] bg-[var(--input)] px-3 py-1 font-mono text-xs text-[var(--foreground)]"
                  value={modelValue}
                  onChange={(e) => setModelValue(e.target.value)}
                >
                  {tier !== "ligero" ? <option value="">— Vacío (hereda) —</option> : null}
                  {!uniqueOptions.includes(modelValue) && modelValue ? (
                    <option value={modelValue}>{modelValue}</option>
                  ) : null}
                  {uniqueOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="tier-model-value"
                  value={modelValue}
                  onChange={(e) => setModelValue(e.target.value)}
                  placeholder={
                    tier === "ligero"
                      ? "p. ej. anthropic/claude-haiku"
                      : "Vacío = hereda del tier inferior"
                  }
                  className={cn("font-mono text-xs")}
                />
              )}
              {tier !== "ligero" ? (
                <p className="text-xs text-[var(--foreground-muted)]">
                  Deja vacío para que herede del tier inferior.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || loadingCatalog}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
