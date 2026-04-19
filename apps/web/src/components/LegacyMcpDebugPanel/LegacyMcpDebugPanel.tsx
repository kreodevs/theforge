import { useCallback, useState } from "react";
import { Bug, Check, Copy } from "lucide-react";
import type { LegacyMcpDebugEntry } from "../../store/workshopStore";

export function formatLegacyMcpTraceForClipboard(trace: LegacyMcpDebugEntry[]): string {
  if (trace.length === 0) return "(sin entradas MCP)\n";
  return trace
    .map((e, i) => {
      const lines = [
        `--- MCP ${i + 1}/${trace.length} ---`,
        `at: ${e.at}`,
        `rpcMethod: ${e.rpcMethod}`,
        `http: ${e.responseHttpStatus}  durationMs: ${e.durationMs}`,
      ];
      if (e.toolName) lines.push(`tool: ${e.toolName}`);
      lines.push("", "Petición:", e.requestJson, "", "Respuesta (preview):", e.responseBodyPreview, "");
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Panel colapsable con ida y vuelta JSON-RPC hacia el MCP Ariadne (cuando el API devuelve `mcpDebugTrace`).
 */
export default function LegacyMcpDebugPanel({ trace }: { trace: LegacyMcpDebugEntry[] | null }) {
  const [copied, setCopied] = useState(false);

  const copyFullTrace = useCallback(async () => {
    if (trace == null) return;
    const text = formatLegacyMcpTraceForClipboard(trace);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sin permiso / contexto no seguro */
    }
  }, [trace]);

  if (trace == null) return null;

  return (
    <details className="group rounded-lg border border-emerald-900/50 bg-zinc-950/80 text-xs shrink-0">
      <summary className="cursor-pointer list-none flex flex-wrap items-center gap-2 px-3 py-2.5 text-emerald-400/90 hover:text-emerald-300 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Bug className="w-3.5 h-3.5 shrink-0 opacity-80" />
          <span className="font-medium">Debug MCP (Ariadne)</span>
          <span className="text-zinc-500 font-normal">
            {trace.length === 0 ? "sin llamadas" : `${trace.length} petición${trace.length === 1 ? "" : "es"}`}
          </span>
        </span>
        <button
          type="button"
          title="Copiar toda la traza (petición + respuesta) al portapapeles"
          className="inline-flex shrink-0 items-center gap-1 rounded border border-emerald-800/60 bg-emerald-950/50 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/40"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void copyFullTrace();
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar traza"}
        </button>
      </summary>
      <div className="border-t border-zinc-700/80 px-3 py-3 space-y-4 max-h-[min(50vh,480px)] overflow-auto font-mono text-[11px] leading-relaxed text-zinc-300">
        {trace.length === 0 ? (
          <p className="text-zinc-500">No se registraron round-trips MCP en esta generación.</p>
        ) : (
          trace.map((e, i) => (
            <article key={`${e.at}-${i}`} className="space-y-2 border-b border-zinc-800/90 pb-4 last:border-0 last:pb-0">
              <header className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-500">
                <span className="text-amber-500/90">{e.rpcMethod}</span>
                {e.toolName ? <span className="text-zinc-400">tool: {e.toolName}</span> : null}
                <span>HTTP {e.responseHttpStatus}</span>
                <span>{e.durationMs} ms</span>
                <span className="text-zinc-600">{e.at}</span>
              </header>
              <div>
                <p className="text-zinc-500 mb-1">Petición</p>
                <pre className="whitespace-pre-wrap break-words rounded bg-black/40 border border-zinc-800 p-2 text-zinc-400 max-h-40 overflow-auto">
                  {e.requestJson}
                </pre>
              </div>
              <div>
                <p className="text-zinc-500 mb-1">Respuesta (preview)</p>
                <pre className="whitespace-pre-wrap break-words rounded bg-black/40 border border-zinc-800 p-2 text-zinc-400 max-h-48 overflow-auto">
                  {e.responseBodyPreview}
                </pre>
              </div>
            </article>
          ))
        )}
      </div>
    </details>
  );
}
