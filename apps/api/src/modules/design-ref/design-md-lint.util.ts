/**
 * design-md-lint.util — Integra el CLI oficial `@google/design.md`.
 *
 * Ejecuta `design.md lint --format json -` (stdin) sobre el contenido de un
 * DESIGN.md para validar de forma automática, entre otras reglas:
 * - Contraste WCAG AA (regla `contrast-ratio`)
 * - Orden canónico de secciones (regla `section-order`)
 * - Referencias de tokens rotas, `primary`/typography faltantes, etc.
 *
 * El linter nunca bloquea el pipeline: si el CLI no está disponible o falla,
 * se devuelve un resultado marcado como `unavailable` sin lanzar excepción.
 */
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, parse } from "node:path";

export type DesignMdLintSeverity = "error" | "warning" | "info";

export interface DesignMdLintFinding {
  severity: DesignMdLintSeverity;
  path?: string;
  message: string;
}

export interface DesignMdLintSummary {
  errors: number;
  warnings: number;
  infos: number;
}

export interface DesignMdLintResult {
  /** El CLI corrió y no hubo findings de severidad `error` (los warnings no fallan). */
  ok: boolean;
  /** El CLI no pudo ejecutarse (dependencia ausente, timeout, etc.). No bloquea. */
  unavailable: boolean;
  findings: DesignMdLintFinding[];
  summary: DesignMdLintSummary;
}

const EMPTY_SUMMARY: DesignMdLintSummary = { errors: 0, warnings: 0, infos: 0 };

/** Resultado seguro cuando el CLI no puede ejecutarse. */
function unavailableResult(): DesignMdLintResult {
  return { ok: true, unavailable: true, findings: [], summary: { ...EMPTY_SUMMARY } };
}

let cachedCliEntry: string | null | undefined;

/**
 * Localiza el entrypoint (`dist/index.js`) del CLI `@google/design.md`.
 *
 * `require.resolve` no sirve: el paquete es ESM-only y su `exports` no expone
 * `package.json` ni una condición `require`. En su lugar, se camina hacia arriba
 * desde `__dirname`/cwd buscando el paquete o su symlink en `.bin`.
 */
function resolveDesignMdCliEntry(): string | null {
  if (cachedCliEntry !== undefined) return cachedCliEntry;

  const here = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const seeds = [process.cwd(), here];
  const visited = new Set<string>();

  for (const seed of seeds) {
    let dir = seed;
    const root = parse(dir).root;
    while (!visited.has(dir)) {
      visited.add(dir);

      const pkgEntry = join(dir, "node_modules", "@google", "design.md", "dist", "index.js");
      if (existsSync(pkgEntry)) {
        cachedCliEntry = pkgEntry;
        return cachedCliEntry;
      }

      const binLink = join(dir, "node_modules", ".bin", "design.md");
      if (existsSync(binLink)) {
        try {
          cachedCliEntry = realpathSync(binLink);
          return cachedCliEntry;
        } catch {
          // symlink roto; continuar buscando
        }
      }

      if (dir === root) break;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  cachedCliEntry = null;
  return cachedCliEntry;
}

interface RawLintOutput {
  findings?: DesignMdLintFinding[];
  summary?: Partial<DesignMdLintSummary>;
}

function computeSummary(findings: DesignMdLintFinding[]): DesignMdLintSummary {
  return findings.reduce<DesignMdLintSummary>(
    (acc, finding) => {
      if (finding.severity === "error") acc.errors += 1;
      else if (finding.severity === "warning") acc.warnings += 1;
      else acc.infos += 1;
      return acc;
    },
    { ...EMPTY_SUMMARY },
  );
}

/**
 * Ejecuta el linter oficial sobre el contenido de un DESIGN.md.
 * Siempre resuelve (nunca rechaza): ante cualquier fallo devuelve `unavailable`.
 */
export async function lintDesignMd(
  content: string,
  timeoutMs = 10_000,
): Promise<DesignMdLintResult> {
  const entry = resolveDesignMdCliEntry();
  if (!entry) return unavailableResult();

  return new Promise<DesignMdLintResult>((resolve) => {
    let settled = false;
    const done = (result: DesignMdLintResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // `-- -` fuerza a citty a tratar `-` como el argumento posicional FILE
    // (leer desde stdin); un `-` suelto lo interpreta como flag.
    const child = spawn(process.execPath, [entry, "lint", "--format", "json", "--", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done(unavailableResult());
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      done(unavailableResult());
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(stdout) as RawLintOutput;
        const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
        const summary: DesignMdLintSummary = {
          ...computeSummary(findings),
          ...parsed.summary,
        };
        done({ ok: summary.errors === 0, unavailable: false, findings, summary });
      } catch {
        done(unavailableResult());
      }
    });

    child.stdin.on("error", () => {
      /* EPIPE si el proceso muere antes de leer stdin */
    });
    child.stdin.end(content);
  });
}

/** Resumen de una línea para logs del pipeline. */
export function formatLintSummary(result: DesignMdLintResult): string {
  if (result.unavailable) return "design.md lint no disponible (omitido)";
  const { errors, warnings, infos } = result.summary;
  return `design.md lint: ${errors} error(es), ${warnings} advertencia(s), ${infos} info`;
}
