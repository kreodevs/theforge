import { Brain, CheckCircle2, RefreshCw } from "lucide-react";

interface AdrItem {
  title?: string;
  status?: string;
  context?: string;
  consequence?: string;
  [key: string]: unknown;
}

interface AdrsPanelProps {
  adrs: AdrItem[];
  projectId: string;
  onRefresh: (projectId: string) => void;
}

/** Panel de Decisiones Arquitectónicas — lista de ADRs persistidas en el Grafo de Memoria Semántica. */
export function AdrsPanel({ adrs, projectId, onRefresh }: AdrsPanelProps) {
  return (
    <div className="flex flex-col gap-6 h-full min-h-0 overflow-auto">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--primary)]">Decisiones Arquitectónicas (ADRs)</h3>
          <p className="text-sm text-[var(--muted-foreground)]">Historial de decisiones persistidas en el Grafo de Memoria Semántica.</p>
        </div>
        <button
          onClick={() => onRefresh(projectId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--muted)_62%,var(--card))] text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {adrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center opacity-50">
          <Brain className="w-12 h-12 mb-4 text-[color-mix(in_oklch,var(--foreground-subtle)_82%,var(--background))]" />
          <p className="text-[var(--muted-foreground)]">No hay decisiones guardadas aún para este proyecto.</p>
          <p className="text-xs text-[var(--foreground-subtle)] mt-2">Las decisiones se extraen automáticamente al finalizar el MDD.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {adrs.map((adr, i) => (
            <div key={i} className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[color-mix(in_oklch,var(--primary)_45%,var(--border))] transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-[var(--foreground)] flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${adr.status === 'Accepted' ? 'text-[var(--success)]' : 'text-[var(--primary)]'}`} />
                  {adr.title}
                </h4>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${adr.status === 'Accepted' ? 'bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-[color-mix(in_oklch,var(--success)_88%,var(--foreground))]' : 'bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-[var(--primary)]'}`}>
                  {adr.status}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-bold text-[var(--foreground-subtle)] uppercase">Contexto</p>
                  <p className="text-sm text-[color-mix(in_oklch,var(--foreground)_88%,var(--muted-foreground))] leading-relaxed">{adr.context}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[var(--foreground-subtle)] uppercase">Consecuencia</p>
                  <p className="text-sm text-[color-mix(in_oklch,var(--foreground)_88%,var(--muted-foreground))] leading-relaxed italic border-l-2 border-[var(--border)] pl-3">{adr.consequence}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
