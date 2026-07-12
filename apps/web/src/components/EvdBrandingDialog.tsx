import { useCallback, useRef, useState } from "react";
import { Upload, Palette, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { API_BASE } from "@/utils/apiClient";
import type { EvdBranding } from "@theforge/shared-types/evd-types";

const COLOR_FIELDS: Array<{ key: keyof EvdBranding; label: string }> = [
  { key: "primaryColor", label: "Primary" },
  { key: "secondaryColor", label: "Secondary" },
  { key: "accentColor", label: "Accent" },
  { key: "highlightColor", label: "Highlight" },
  { key: "bgColor", label: "Background" },
  { key: "textColor", label: "Text" },
];

export interface EvdBrandingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  branding: EvdBranding;
  onBrandingSaved: (branding: EvdBranding) => void;
}

export function EvdBrandingDialog({
  open,
  onOpenChange,
  projectId,
  branding: initialBranding,
  onBrandingSaved,
}: EvdBrandingDialogProps) {
  const [branding, setBranding] = useState<EvdBranding>(initialBranding);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateColor = useCallback((key: keyof EvdBranding, value: string) => {
    setBranding((prev: EvdBranding) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/evd/${projectId}/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (res.ok) onBrandingSaved(branding);
    } finally {
      setSaving(false);
    }
  }, [branding, projectId, onBrandingSaved]);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await fetch(`${API_BASE}/evd/${projectId}/logo`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        setBranding((prev: EvdBranding) => ({
          ...prev,
          logoUrl: `${API_BASE}/evd/${projectId}/logo?t=${Date.now()}`,
        }));
      }
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [projectId]);

  const handleRemoveLogo = useCallback(() => {
    setBranding((prev: EvdBranding) => ({ ...prev, logoUrl: null }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding del EVD
          </DialogTitle>
          <DialogDescription>
            Personaliza colores, tipografía y logo de la presentación.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Color fields */}
          <div className="grid grid-cols-3 gap-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key as string} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={typeof branding[key] === "string" ? (branding[key] as string) : "#000000"}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0"
                  />
                  <Input
                    value={typeof branding[key] === "string" ? (branding[key] as string) : ""}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="h-8 flex-1 text-xs font-mono"
                  />
                </div>
              </label>
            ))}
          </div>

          {/* Font family */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Font Family</span>
            <Input
              value={branding.fontFamily}
              onChange={(e) => setBranding((prev: EvdBranding) => ({ ...prev, fontFamily: e.target.value }))}
              placeholder="Inter, system-ui, sans-serif"
              className="h-8 text-sm"
            />
          </label>

          {/* Logo */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Logo</span>
            <div className="flex items-center gap-3">
              {branding.logoUrl && (
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)]">
                  <img src={branding.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -right-1 -top-1 rounded-full bg-[var(--destructive)] p-0.5 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingLogo}
                loading={uploadingLogo}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {branding.logoUrl ? "Cambiar logo" : "Subir logo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} loading={saving}>
            Guardar branding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
