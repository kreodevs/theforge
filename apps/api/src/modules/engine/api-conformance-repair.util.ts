import {
  checkApiVsMdd,
  extractMddSection4Endpoints,
  normEp,
  type ApiConformanceResult,
} from "./conformance.service.js";

export function runApiConformanceCheck(
  mddContent: string,
  apiContent: string,
): ApiConformanceResult {
  return checkApiVsMdd(mddContent, apiContent);
}

/** Feedback conciso para reintento LLM. */
export function buildApiRetryFeedback(result: ApiConformanceResult): string {
  const parts: string[] = [];
  if (result.missingInApi.length > 0) {
    parts.push(
      `Faltan ${result.missingInApi.length} endpoint(s) del MDD §4 en el documento API. ` +
        `DEBES añadir UNA fila por endpoint en la tabla markdown (Método | Ruta | …): ` +
        result.missingInApi.slice(0, 12).join(", ") +
        (result.missingInApi.length > 12 ? ", …" : ""),
    );
  }
  if (result.extraInApi.length > 0) {
    parts.push(
      `Elimina o alinea ${result.extraInApi.length} endpoint(s) no declarados en MDD §4: ` +
        result.extraInApi.slice(0, 8).join(", ") +
        (result.extraInApi.length > 8 ? ", …" : ""),
    );
  }
  return parts.join("\n\n");
}

function parseNormEndpoint(norm: string): { method: string; path: string } {
  const m = norm.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
  if (!m) return { method: "GET", path: norm };
  return { method: m[1]!.toUpperCase(), path: m[2]! };
}

/** Añade filas de tabla para endpoints §4 ausentes (conformidad determinista). */
export function injectMissingApiEndpoints(mddContent: string, apiContent: string): string {
  const check = checkApiVsMdd(mddContent, apiContent);
  if (check.missingInApi.length === 0) return apiContent;

  const mddNormToOriginal = new Map(
    extractMddSection4Endpoints(mddContent).map((ep) => [normEp(ep), ep]),
  );

  const rows: string[] = [];
  for (const missingNorm of check.missingInApi) {
    const original = mddNormToOriginal.get(missingNorm) ?? parseNormEndpoint(missingNorm);
    const path = original.path.replace(/`/g, "").trim();
    rows.push(
      `| ${original.method.toUpperCase()} | \`${path}\` | (completado automáticamente — ampliar schemas) | Bearer | MDD §4 |`,
    );
  }

  const block =
    `\n\n## Endpoints completados automáticamente (MDD §4)\n\n` +
    `| Método | Ruta | Descripción | Auth | Notas |\n` +
    `|--------|------|-------------|------|-------|\n` +
    rows.join("\n") +
    `\n`;

  return apiContent.trimEnd() + block;
}

/** Reparación post-IA: filas faltantes del MDD §4. */
export function repairApiProgrammaticGaps(mddContent: string, apiContent: string): string {
  return injectMissingApiEndpoints(mddContent, apiContent);
}
