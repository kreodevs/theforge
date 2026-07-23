/** Retraso antes de revocar blob URLs (ZIPs grandes necesitan tiempo para iniciar la descarga). */
const BLOB_URL_REVOKE_MS = 60_000;

/**
 * Dispara una descarga de archivo en el navegador.
 * Retiene el object URL un rato para evitar que ZIPs grandes fallen al revocar demasiado pronto.
 */
export function triggerBrowserBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_REVOKE_MS);
}
