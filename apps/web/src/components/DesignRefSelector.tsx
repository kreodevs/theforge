/**
 * DesignRefSelector — Selector de Design References para la Guía UX/UI
 *
 * Permite:
 * 1. Elegir manualmente entre los design systems reales (lista estilo "contactos",
 *    ordenada alfabéticamente con índice A-Z y buscador)
 * 2. Activar "Auto-match" para que el LLM infiera el diseño del MDD
 * 3. Ingresar URL personalizada para escanear tokens reales del sitio
 *
 * Diseño alineado al tema "Claude+" de The Forge (tokens CSS, sin colores crudos).
 * Integrado en el Workshop, antes de generar la Guía UX/UI.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ChevronDown, Sparkles, Globe, RefreshCw, Search, X, Ban } from "lucide-react";
import { apiFetch, API_BASE } from "@/utils/apiClient";

export interface DesignRefItem {
  slug: string;
  name: string;
  category: string;
  style: string;
  tags: string[];
  source?: string;
  galleryUrl?: string;
  hasDesignMdImport?: boolean;
  inspirationSource?: "design-extractor" | "builtin";
  inspirationUrl?: string;
  attributionNote?: string;
  colors?: Record<string, string | undefined>;
}

/** Índice alfabético completo estilo agenda de contactos. */
const ALPHABET_INDEX: readonly string[] = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "#",
];

interface DesignRefSelectorProps {
  /** Slug actualmente seleccionado (desde el proyecto) */
  currentRef?: string | null;
  /** Callback cuando cambia la selección */
  onChange: (ref: string | null) => void;
  /** Si está en modo "auto-match" */
  onAutoMatch?: () => void;
}

/** Devuelve la letra de agrupación (A-Z) o "#" para nombres que no inician con letra. */
function getGroupLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

export function DesignRefSelector({ currentRef, onChange, onAutoMatch }: DesignRefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<DesignRefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "url">("catalog");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [scannedColors, setScannedColors] = useState<Record<string, string> | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Cargar catálogo
  useEffect(() => {
    apiFetch(`${API_BASE}/design-refs`)
      .then((r) => r.json())
      .then((data: DesignRefItem[]) => setDesigns(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cerrar con Escape; enfocar el buscador al abrir el catálogo
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    if (activeTab === "catalog") {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        window.clearTimeout(timer);
      };
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, activeTab]);

  const selected = designs.find((d) => d.slug === currentRef);
  const isAuto = currentRef === "auto";

  const handleSelect = useCallback(
    (slug: string) => {
      onChange(slug);
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setOpen(false);
  }, [onChange]);

  const handleAuto = useCallback(() => {
    onChange("auto");
    onAutoMatch?.();
    setOpen(false);
  }, [onChange, onAutoMatch]);

  const handleUrlSubmit = useCallback(() => {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    setScannedColors(null);
    apiFetch(`${API_BASE}/design-refs/scan-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    })
      .then((r) => r.json())
      .then((data: { error?: string; tokens?: { colors?: Record<string, string> } }) => {
        if (data.error || !data.tokens) {
          setUrlError(data.error ?? "No se pudieron extraer tokens del sitio.");
          return;
        }
        setScannedColors(data.tokens.colors ?? null);
        onChange(`url:${url.trim()}`);
      })
      .catch((err) => setUrlError(err instanceof Error ? err.message : "Fallo al escanear la URL."))
      .finally(() => setUrlLoading(false));
  }, [url, onChange]);

  // Filtrado por búsqueda (nombre, estilo o tags)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return designs;
    return designs.filter(
      (d) =>
        d.name.toLowerCase().includes(normalized) ||
        d.style.toLowerCase().includes(normalized) ||
        d.tags?.some((t) => t.toLowerCase().includes(normalized)),
    );
  }, [designs, query]);

  // Agrupación alfabética estilo contactos
  const { groupedByLetter, activeLetters } = useMemo(() => {
    const groups = filtered.reduce<Record<string, DesignRefItem[]>>((acc, d) => {
      const letter = getGroupLetter(d.name);
      (acc[letter] ??= []).push(d);
      return acc;
    }, {});
    Object.values(groups).forEach((items) =>
      items.sort((a, b) => a.name.localeCompare(b.name, "es")),
    );
    const letters = ALPHABET_INDEX.filter((letter) => groups[letter]?.length);
    return { groupedByLetter: groups, activeLetters: letters };
  }, [filtered]);

  const handleJumpToLetter = useCallback((letter: string) => {
    const container = listRef.current;
    const section = sectionRefs.current[letter];
    if (!container || !section) return;
    container.scrollTo({ top: section.offsetTop - container.offsetTop, behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-2">
      {/* Descripción de la funcionalidad */}
      <p className="text-xs leading-relaxed text-[var(--foreground-subtle)]">
        Referencias visuales <span className="text-[var(--foreground-muted)]">inspiradas en</span> sistemas públicos curados en{" "}
        <a
          href="https://www.design-extractor.com/gallery"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          design-extractor.com
        </a>
        . The Forge <span className="text-[var(--foreground-muted)]">adapta tokens</span> al dominio de tu MDD; no es copia ni producto
        oficial de esas marcas. Si ya hay Design System, <span className="text-[var(--foreground-muted)]">al cambiar referencia se regenera</span>{" "}
        (requiere MDD y Blueprint). Usa <span className="font-medium text-[var(--primary)]">auto-match</span> o elige del catálogo.
      </p>

      <div ref={rootRef} className="relative">
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm transition-colors hover:border-[var(--border-hover)]"
        >
          {isAuto ? (
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--primary)]" />
          ) : selected ? (
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-[var(--border)]"
              style={{ backgroundColor: selected.colors?.primary || "var(--muted-foreground)" }}
            />
          ) : (
            <Globe className="h-4 w-4 shrink-0 text-[var(--foreground-muted)]" />
          )}
          <span className="flex-1 truncate text-left">
            {isAuto ? "Auto-match (automático)" : selected?.name || "Sin referencia de diseño"}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--foreground-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 top-full z-[var(--z-dropdown)] mt-1.5 w-[420px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-lg">
            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
              <button
                onClick={() => setActiveTab("catalog")}
                className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === "catalog"
                    ? "border-b-2 border-[var(--primary)] text-[var(--foreground)]"
                    : "border-b-2 border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Catálogo
              </button>
              <button
                onClick={() => setActiveTab("url")}
                className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === "url"
                    ? "border-b-2 border-[var(--primary)] text-[var(--foreground)]"
                    : "border-b-2 border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                URL personalizada
              </button>
            </div>

            {activeTab === "catalog" && (
              <>
                {/* Buscador */}
                <div className="border-b border-[var(--border)] p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nombre, estilo o etiqueta…"
                      className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input)] pl-8 pr-8 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        aria-label="Limpiar búsqueda"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Opciones fijas: Auto-match / Ninguna */}
                {!query && (
                  <div className="border-b border-[var(--border)] p-2">
                    <button
                      onClick={handleAuto}
                      className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--accent)] ${
                        isAuto ? "bg-[var(--accent)] ring-1 ring-[var(--primary)]" : ""
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--primary)_15%,transparent)]">
                        <Sparkles className="h-4 w-4 text-[var(--primary)]" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--foreground)]">Auto-match</p>
                        <p className="truncate text-xs text-[var(--foreground-muted)]">
                          El LLM infiere el diseño del MDD automáticamente
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={handleClear}
                      className={`mt-1 flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--accent)] ${
                        !currentRef ? "bg-[var(--accent)] ring-1 ring-[var(--border-hover)]" : ""
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)]">
                        <Ban className="h-4 w-4 text-[var(--foreground-muted)]" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--foreground)]">Ninguna</p>
                        <p className="truncate text-xs text-[var(--foreground-muted)]">
                          El LLM genera el diseño desde cero
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Lista alfabética estilo contactos */}
                <div className="relative">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--foreground-muted)]">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cargando…
                    </div>
                  ) : activeLetters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
                      <Search className="h-5 w-5 text-[var(--foreground-muted)]" />
                      <p className="text-sm font-medium text-[var(--foreground)]">Sin resultados</p>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        No hay referencias que coincidan con «{query}».
                      </p>
                    </div>
                  ) : (
                    <>
                      <div ref={listRef} className="relative max-h-[340px] overflow-y-auto py-1 pl-1 pr-6">
                        {activeLetters.map((letter) => (
                          <div
                            key={letter}
                            ref={(el) => {
                              sectionRefs.current[letter] = el;
                            }}
                          >
                            <div className="sticky top-0 z-10 bg-[color-mix(in_oklch,var(--popover)_92%,transparent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] backdrop-blur">
                              {letter}
                            </div>
                            {(groupedByLetter[letter] ?? []).map((d) => (
                              <button
                                key={d.slug}
                                onClick={() => handleSelect(d.slug)}
                                className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--accent)] ${
                                  currentRef === d.slug ? "bg-[var(--accent)] ring-1 ring-[var(--primary)]" : ""
                                }`}
                              >
                                <span
                                  className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-[var(--border)]"
                                  style={{ backgroundColor: d.colors?.primary || "var(--muted-foreground)" }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-[var(--foreground)]">
                                    {d.name}
                                    {d.hasDesignMdImport && (
                                      <span className="ml-1.5 text-[10px] font-normal text-[var(--primary)]">
                                        DESIGN.md
                                      </span>
                                    )}
                                  </p>
                                  <p className="truncate text-xs text-[var(--foreground-muted)]">
                                    {d.style}
                                    {d.inspirationSource === "design-extractor" && (
                                      <span className="text-[var(--foreground-subtle)]"> · inspirado en design-extractor</span>
                                    )}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* Índice alfabético A-Z (rail lateral estilo contactos) */}
                      <div className="absolute inset-y-1.5 right-1 flex w-3.5 flex-col items-stretch select-none">
                        {ALPHABET_INDEX.map((letter) => {
                          const enabled = activeLetters.includes(letter);
                          return (
                            <button
                              key={letter}
                              type="button"
                              disabled={!enabled}
                              onClick={() => handleJumpToLetter(letter)}
                              className={`flex flex-1 items-center justify-center rounded-sm text-[10px] font-semibold leading-none transition-colors ${
                                enabled
                                  ? "text-[var(--foreground-muted)] hover:text-[var(--primary)]"
                                  : "cursor-default text-[var(--foreground-subtle)] opacity-30"
                              }`}
                              aria-label={`Ir a ${letter}`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {activeTab === "url" && (
              <div className="p-4">
                <p className="mb-2 text-xs text-[var(--foreground-muted)]">
                  Ingresa la URL de un sitio web para extraer sus tokens de diseño (colores, tipografía, CSS variables).
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://ejemplo.com"
                    className="h-9 flex-1 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                  />
                  <button
                    onClick={handleUrlSubmit}
                    disabled={urlLoading || !url.trim()}
                    className="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
                  >
                    {urlLoading ? "Escaneando…" : "Scan"}
                  </button>
                </div>
                {urlError && (
                  <p className="mt-2 text-[11px] text-[var(--destructive,#DC2626)]">{urlError}</p>
                )}
                {scannedColors && (
                  <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                    <p className="mb-2 text-[11px] font-medium text-[var(--foreground)]">
                      Tokens detectados y aplicados
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(scannedColors).map(([role, hex]) => (
                        <div key={role} className="flex items-center gap-1.5">
                          <span
                            className="h-4 w-4 rounded-full border border-[var(--border)]"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="text-[10px] text-[var(--foreground-muted)]">
                            {role} {hex}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!urlError && !scannedColors && (
                  <p className="mt-2 text-[11px] text-[var(--foreground-subtle)]">
                    Extraemos colores, tipografía y CSS variables reales del sitio.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
