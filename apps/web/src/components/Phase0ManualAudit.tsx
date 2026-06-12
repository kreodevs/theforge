/**
 * Auditoría manual de Paso 0 — re-analiza gaps y lanza preguntas si falta información.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ClipboardCheck, Loader2, Send, AlertTriangle } from "lucide-react";
import { apiFetch, API_BASE } from "../utils/apiClient";
import {
  formatUserFacingThrownError,
  parseApiErrorPayloadFromResponse,
} from "../utils/httpError";
import {
  isModelsUnavailableStreamError,
  resolvePhase0ErrorMessage,
} from "../utils/llm-stream-error";
import { useWorkshopStore } from "../store/workshopStore";
import { WorkshopPanelButton, WorkshopButtonIcon } from "./WorkshopButtons";

type AuditUiStatus = "idle" | "loading" | "interviewing" | "complete" | "error";

type Phase0AuditPayload = {
  type?: string;
  message?: string;
  code?: string;
  threadId?: string;
  borrador?: unknown;
  gaps?: unknown;
  question?: string;
  n?: number;
  total?: number;
};

interface Props {
  projectId: string;
  onUpdated?: () => void | Promise<void>;
  /** inline = debajo del mensaje de Fase 0 completada; panel = bloque en vista con borrador */
  variant?: "inline" | "panel";
  /** Auditoría ya iniciada (p. ej. tras fusión de proyectos). */
  initialAudit?: {
    type: string;
    threadId?: string;
    question?: string;
    n?: number;
    total?: number;
    message?: string;
  } | null;
}

export function Phase0ManualAudit({ projectId, onUpdated, variant = "panel", initialAudit }: Props) {
  const [status, setStatus] = useState<AuditUiStatus>("idle");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [preguntaN, setPreguntaN] = useState(0);
  const [totalPreguntas, setTotalPreguntas] = useState(0);
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!initialAudit || !projectId?.trim()) return;
    if (initialAudit.type === "audit_started" && initialAudit.threadId) {
      setThreadId(initialAudit.threadId);
      setQuestion(initialAudit.question ?? "");
      setPreguntaN(initialAudit.n ?? 1);
      setTotalPreguntas(initialAudit.total ?? 5);
      setStatus("interviewing");
      setError(null);
      setCompleteMessage(null);
    } else if (initialAudit.type === "audit_complete") {
      setStatus("complete");
      setCompleteMessage(initialAudit.message ?? "Auditoría completada.");
    }
  }, [initialAudit, projectId]);

  const startAudit = useCallback(async () => {
    if (!projectId?.trim()) return;
    setStatus("loading");
    setError(null);
    setCompleteMessage(null);
    setThreadId(null);

    try {
      const res = await apiFetch(`${API_BASE}/ai-analysis/phase0/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId.trim() }),
      });
      if (!res.ok) {
        const { message, code } = await parseApiErrorPayloadFromResponse(
          res,
          "No se pudo ejecutar la auditoría",
        );
        const payload = { message, code };
        if (isModelsUnavailableStreamError(payload)) {
          useWorkshopStore.getState().setModelsUnavailableModalOpen(true);
        }
        throw new Error(resolvePhase0ErrorMessage(payload));
      }

      const data = (await res.json()) as Phase0AuditPayload;

      if (data.type === "error") {
        throw new Error(resolvePhase0ErrorMessage(data));
      }

      if (data.type === "audit_complete") {
        setCompleteMessage(
          data.message ??
            "No quedan gaps críticos ni importantes por definir en Paso 0.",
        );
        setStatus("complete");
        await onUpdated?.();
        return;
      }

      if (data.type === "audit_started" && data.threadId && data.question) {
        setThreadId(data.threadId);
        setQuestion(data.question);
        setPreguntaN(data.n ?? 1);
        setTotalPreguntas(data.total ?? 1);
        setStatus("interviewing");
        setAnswer("");
        setTimeout(() => inputRef.current?.focus(), 100);
        return;
      }

      throw new Error("Respuesta inesperada de la auditoría");
    } catch (e) {
      setError(formatUserFacingThrownError(e, "No se pudo ejecutar la auditoría"));
      setStatus("error");
    }
  }, [projectId, onUpdated]);

  const handleAnswer = useCallback(async () => {
    if (!answer.trim() || !threadId || isSubmitting) return;
    const currentAnswer = answer.trim();
    setAnswer("");
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch(`${API_BASE}/ai-analysis/phase0/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, answer: currentAnswer, projectId }),
      });
      if (!res.ok) {
        const { message, code } = await parseApiErrorPayloadFromResponse(
          res,
          "No se pudo enviar tu respuesta",
        );
        const payload = { message, code };
        if (isModelsUnavailableStreamError(payload)) {
          useWorkshopStore.getState().setModelsUnavailableModalOpen(true);
        }
        throw new Error(resolvePhase0ErrorMessage(payload));
      }

      const data = (await res.json()) as Phase0AuditPayload;

      if (data.type === "error") {
        throw new Error(resolvePhase0ErrorMessage(data));
      }

      if (data.type === "done") {
        setCompleteMessage(
          data.message ?? "Auditoría completada. Borrador de Paso 0 actualizado.",
        );
        setStatus("complete");
        setThreadId(null);
        await onUpdated?.();
        return;
      }

      if (data.type === "question" && data.question) {
        setQuestion(data.question);
        setPreguntaN(data.n ?? 1);
        if (typeof data.total === "number") setTotalPreguntas(data.total);
        setTimeout(() => inputRef.current?.focus(), 100);
        return;
      }

      throw new Error("Respuesta inesperada al enviar tu respuesta");
    } catch (e) {
      setError(formatUserFacingThrownError(e, "No se pudo enviar tu respuesta"));
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [answer, threadId, isSubmitting, projectId, onUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && status === "interviewing") {
      e.preventDefault();
      void handleAnswer();
    }
  };

  const reset = () => {
    setStatus("idle");
    setThreadId(null);
    setQuestion("");
    setAnswer("");
    setError(null);
    setCompleteMessage(null);
  };

  const wrapperClass =
    variant === "inline"
      ? "mt-4 w-full max-w-lg"
      : "rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] p-4";

  return (
    <div className={wrapperClass}>
      {status === "idle" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            ¿Crees que ya está al 100%? Ejecuta una auditoría: validará el borrador y, si falta
            algo, te hará preguntas puntuales.
          </p>
          <div>
            <WorkshopPanelButton tone="secondary" onClick={() => void startAudit()}>
              <WorkshopButtonIcon icon={ClipboardCheck} tone="secondary" />
              Auditar Paso 0
            </WorkshopPanelButton>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-[var(--foreground-subtle)]">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Analizando completitud del borrador…</span>
        </div>
      )}

      {status === "complete" && completeMessage && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-[color-mix(in_oklch,var(--success)_35%,var(--border))] bg-[color-mix(in_oklch,var(--success)_10%,var(--card))] p-3">
            <Check className="w-5 h-5 shrink-0 text-[color-mix(in_oklch,var(--success)_88%,var(--foreground))]" />
            <p className="text-sm text-[var(--foreground)] leading-relaxed">{completeMessage}</p>
          </div>
          <WorkshopPanelButton tone="secondary" onClick={reset}>
            Auditar de nuevo
          </WorkshopPanelButton>
        </div>
      )}

      {status === "interviewing" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
            Auditoría · Pregunta {preguntaN} de {totalPreguntas}
          </p>
          {isSubmitting && (
            <div className="flex items-center gap-2 text-sm text-[var(--foreground-subtle)]">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Actualizando borrador…</span>
            </div>
          )}
          <div className="rounded-lg border border-[color-mix(in_oklch,var(--primary)_20%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] p-3">
            <p className="text-sm text-[var(--foreground)]">{question}</p>
          </div>
          <textarea
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            placeholder="Tu respuesta…"
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] p-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
          />
          <div className="flex justify-end">
            <WorkshopPanelButton
              tone="primary"
              onClick={() => void handleAnswer()}
              disabled={!answer.trim() || isSubmitting}
              loading={isSubmitting}
            >
              <WorkshopButtonIcon icon={Send} tone="primary" />
              Enviar respuesta
            </WorkshopPanelButton>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 text-sm text-[color-mix(in_oklch,var(--destructive)_88%,var(--foreground))]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error ?? "Error en la auditoría"}</span>
          </div>
          <WorkshopPanelButton tone="secondary" onClick={reset}>
            Reintentar
          </WorkshopPanelButton>
        </div>
      )}
    </div>
  );
}
