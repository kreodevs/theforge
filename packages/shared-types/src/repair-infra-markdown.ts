/**
 * Reparaciones para documentos de Infra (Dockerfile, compose, .env) mal formateados por LLM.
 */

const DOCKER_INSTR =
  /^(FROM|WORKDIR|RUN|COPY|CMD|EXPOSE|USER|ENV|ARG|LABEL|ADD|VOLUME|ENTRYPOINT|STOPSIGNAL|HEALTHCHECK|SHELL|ONBUILD|MAINTAINER)\b/i;

function isDockerfileLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (DOCKER_INSTR.test(trimmed)) return true;
  if (/^#\s*----/.test(trimmed)) return true;
  if (/^#\s*(Copiar|Instalar|Compilar|Generar|Crear|Exponer|Usar|Comando|Construir|Nginx)/i.test(trimmed)) {
    return true;
  }
  return false;
}

/** `### WORKDIR /app` → `WORKDIR /app` (falso heading sobre instrucción Docker). */
export function repairFalseDockerfileHeadings(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const m = line.trim().match(/^###\s+(.+)$/);
      if (!m) return line;
      const inner = m[1]!.trim();
      if (isDockerfileLine(inner)) return inner;
      return line;
    })
    .join("\n");
}

/** Elimina fences ``` sueltos entre secciones de infra (--- / ##). */
export function repairStrayInfraFences(text: string): string {
  let out = text.replace(/\n---\s*\n+```\s*\n+(?=##\s)/g, "\n---\n\n");
  out = out.replace(/(\n##\s+\d+\.[^\n]+\n)\n```\s*\n+(?=[#\w])/g, "$1\n");
  out = out.replace(/(\n```(?:dockerfile|yaml|env)?\s*\n[\s\S]*?\n```)\s*\n```\s*\n+(?=##\s)/g, "$1\n\n");
  out = out.replace(/(\n(?:FROM|CMD|EXPOSE|USER)\b[^\n]*)\n```\s*\n+(?=---|\n##\s)/g, "$1\n\n");
  return out;
}

/** Envuelve bloques Dockerfile sueltos en ```dockerfile (por subsección Backend/Frontend). */
export function repairOrphanDockerfileBlocks(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inAnyFence = false;
  let inDockerFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();

    if (/^```/.test(t)) {
      if (inDockerFence && t === "```") {
        inDockerFence = false;
        inAnyFence = false;
      } else if (!inDockerFence) {
        inAnyFence = t !== "```";
      }
      out.push(line);
      continue;
    }

    if (inAnyFence && !inDockerFence) {
      out.push(line);
      continue;
    }

    if (
      inDockerFence &&
      (/^##\s+\d+\./.test(t) || /^###\s+(Frontend|Backend)\b/i.test(t))
    ) {
      out.push("```");
      inDockerFence = false;
      inAnyFence = false;
    }

    if (!inDockerFence && !inAnyFence && isDockerfileLine(t)) {
      out.push("```dockerfile");
      inDockerFence = true;
      inAnyFence = true;
    }

    out.push(line);

    if (inDockerFence && i + 1 < lines.length) {
      const next = lines[i + 1]!.trim();
      if (/^##\s+\d+\./.test(next) || /^###\s+(Frontend|Backend)\b/i.test(next)) {
        out.push("```");
        inDockerFence = false;
        inAnyFence = false;
      }
    }
  }

  if (inDockerFence) out.push("```");
  return out.join("\n");
}

/** Convierte `- image: foo` en YAML con indentación. */
export function repairBulletedYamlLines(yaml: string): string {
  const lines = yaml.split("\n");
  const out: string[] = [];
  let indent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }

    if (/^```/.test(trimmed)) continue;

    if (/^(version|name)\s*:/i.test(trimmed)) {
      indent = 0;
      out.push(trimmed);
      continue;
    }
    if (/^(services|volumes|networks)\s*:/i.test(trimmed)) {
      indent = 0;
      out.push(trimmed);
      if (/^services\s*:/i.test(trimmed)) indent = 2;
      continue;
    }

    const serviceMatch = trimmed.match(/^([a-zA-Z][\w-]*):\s*$/);
    if (serviceMatch && !trimmed.startsWith("-")) {
      out.push(`${" ".repeat(Math.max(indent, 2))}${trimmed}`);
      indent = Math.max(indent, 2) + 2;
      continue;
    }

    const bulletMatch = trimmed.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      const content = bulletMatch[1]!;
      if (/^[a-zA-Z_-]+:\s*$/.test(content)) {
        out.push(`${" ".repeat(indent)}${content}`);
        indent += 2;
      } else {
        out.push(`${" ".repeat(indent)}${content}`);
      }
      continue;
    }

    if (trimmed.startsWith("#")) {
      out.push(`${" ".repeat(Math.max(indent, 2))}${trimmed}`);
      continue;
    }

    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\bdepends on:/gi, "depends_on:")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Sección ## 2. docker-compose → un bloque ```yaml coherente. */
export function repairComposeYamlSection(text: string): string {
  return text.replace(
    /(##\s*2\.[^\n]*docker-compose[^\n]*\n)([\s\S]*?)(?=\n---\s*\n|\n##\s*3\.|$)/i,
    (_full, heading: string, body: string) => {
      let yaml = body;
      yaml = yaml.replace(/```yaml\s*/gi, "");
      yaml = yaml.replace(/^\s*```\s*$/gm, "");
      yaml = yaml.replace(/^```\s*\n/gm, "");
      yaml = repairBulletedYamlLines(yaml);
      if (!yaml.trim()) return heading;
      return `${heading}\n\`\`\`yaml\n${yaml}\n\`\`\`\n`;
    },
  );
}

/** Sección ## 3. Variables de entorno → ```env. */
export function repairEnvExampleSection(text: string): string {
  return text.replace(
    /(##\s*3\.[^\n]*(?:Variables de entorno|\.env)[^\n]*\n)([\s\S]*?)(?=\n---\s*\n|\n##\s*4\.|$)/i,
    (_full, heading: string, body: string) => {
      if (/```env/i.test(body)) return _full;
      let env = body.replace(/^\s*```\s*$/gm, "").trim();
      if (!/^#/.test(env.trim()) && !/^[A-Z_]+=/.test(env.trim())) return _full;
      return `${heading}\n\`\`\`env\n${env}\n\`\`\`\n`;
    },
  );
}

export function repairInfraMarkdown(text: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text.replace(/\r\n/g, "\n");
  out = repairStrayInfraFences(out);
  out = repairFalseDockerfileHeadings(out);
  out = repairOrphanDockerfileBlocks(out);
  out = repairComposeYamlSection(out);
  out = repairEnvExampleSection(out);
  out = repairStrayInfraFences(out);
  return out;
}
