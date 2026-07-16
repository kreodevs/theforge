/** Fallos terminales que no deben dejar el banner de regeneración colgado. */
export function isMddJobTerminalFailure(error?: string): boolean {
  if (!error?.trim()) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("cancelado") ||
    lower.includes("stall") ||
    lower.includes("huérfano") ||
    lower.includes("reinicio del api")
  );
}
