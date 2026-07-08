/** Carga JSZip bajo demanda (descargas ZIP del Workshop). */
export async function loadJsZip() {
  const { default: JSZip } = await import("jszip");
  return JSZip;
}
