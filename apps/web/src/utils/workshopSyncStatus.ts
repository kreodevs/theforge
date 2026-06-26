/** Aviso cuando el API revierte edición directa de patrones SSOT en el MDD. */
export const SSOT_PATTERNS_RESTORED_NOTICE =
  "Patrones SSOT restaurados: solo puedes cambiarlos con «Editar patrones (SSOT)».";

export function isSsotPatternsNotice(message: string | null | undefined): boolean {
  if (!message) return false;
  return message.includes("restaurados") || message.includes("Patrones SSOT");
}

/** Errores de red/sincronización que deben mostrar el badge «Sin conexión». */
export function isWorkshopConnectionError(message: string | null | undefined): boolean {
  if (!message || isSsotPatternsNotice(message)) return false;
  return (
    /sin conexi[oó]n/i.test(message) ||
    /error de red/i.test(message) ||
    /error de conexi[oó]n/i.test(message) ||
    /cambio guardado localmente/i.test(message) ||
    /network connection was lost/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /load failed/i.test(message)
  );
}
