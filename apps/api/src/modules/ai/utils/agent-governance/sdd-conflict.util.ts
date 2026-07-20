import { CLI_FRONTEND_STACK_LABEL, type ProjectGovernanceFacts } from "../suggest-agent-governance-artifacts.js";

export function buildSddConflictTable(facts: ProjectGovernanceFacts): string {
  const rows: Array<{ topic: string; decision: string }> = [];
  const seen = new Set<string>();

  const addRow = (topic: string, decision: string) => {
    const key = topic.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ topic, decision });
  };

  for (const c of facts.sddConflicts) {
    const colon = c.indexOf(":");
    if (colon > 0) {
      addRow(c.slice(0, colon).trim(), c.slice(colon + 1).trim());
    } else {
      addRow("Conflicto SDD", c);
    }
  }

  if (facts.frontendStack?.startsWith("CLI")) {
    addRow(
      "Frontend",
      `MVP: **API REST + CLI** (${CLI_FRONTEND_STACK_LABEL}). Panel web React **fuera de alcance** hasta post-MVP.`,
    );
  }
  if (facts.sddConflicts.some((c) => /BullMQ|Redis|mensajer/i.test(c))) {
    addRow(
      "Messaging / outbox",
      facts.sddConflicts.some((c) => /RabbitMQ del MDD/i.test(c))
        ? "MDD §2: RabbitMQ como broker. No BullMQ/Bull en workers ni tasks del MVP."
        : "MDD §2: Bull + Redis para colas de workers. Publicación outbox → **Redis Pub/Sub**. No Kafka ni RabbitMQ en MVP.",
    );
  }
  if (facts.sddConflicts.some((c) => /JWT/i.test(c))) {
    addRow(
      "JWT",
      "**RS256** con par de claves `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (PEM). `JWT_SECRET` (HS256) quedó **deprecado**.",
    );
  }
  if (facts.sddConflicts.some((c) => /bcrypt|Argon2|Hashing/i.test(c))) {
    addRow(
      "Hashing bootstrap",
      "**bcrypt** (factor 12) para Super Admin de bootstrap; coherente con §6 y Tasks. No Argon2id en manifest salvo que §6 lo exija.",
    );
  }

  if (rows.length === 0) return "";

  const lines = [
    "## Resolución de conflictos SDD\n",
    "Decisiones acordadas al alinear gobernanza con el MDD. **Prioriza siempre el MDD** ante nuevas contradicciones.\n",
    "| Tema | Decisión |",
    "|------|----------|",
    ...rows.map((r) => `| **${r.topic}** | ${r.decision} |`),
    "",
  ];
  return lines.join("\n");
}

export function buildSddConflictSection(facts: ProjectGovernanceFacts): string {
  const table = buildSddConflictTable(facts);
  if (table.trim()) return `${table}\n`;
  if (facts.sddConflicts.length === 0) return "";
  const lines = [
    "## Resolución de conflictos SDD\n\n",
    "El detector encontró posibles contradicciones entre entregables. **Prioriza el MDD** y documenta la decisión en `docs/sdd/PROGRESO.md`.\n\n",
  ];
  for (const c of facts.sddConflicts) lines.push(`- ${c}\n`);
  lines.push("\n");
  return lines.join("");
}

export function stripSddConflictSections(content: string): string {
  return content
    .replace(/## Resolución de conflictos SDD[\s\S]*?(?=\n## [^#]|\n#\s|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function contentHasSddConflicts(content: string, facts: ProjectGovernanceFacts): boolean {
  if (!/Resolución de conflictos SDD/i.test(content)) return false;
  if (facts.sddConflicts.length === 0) return true;
  return facts.sddConflicts.every((c) => {
    const key = c.split(":")[0]?.trim();
    return key ? content.includes(key) : content.includes(c.slice(0, 40));
  });
}
