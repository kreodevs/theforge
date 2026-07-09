/**
 * @fileoverview Technology Docs MCP — optional Context7-compatible documentation enrichment.
 *
 * When `TECH_DOCS_MCP_URL` is unset or the MCP is unreachable, all methods no-op (null).
 * Used by SDD generators (architecture, API contracts, tasks) to reduce library API hallucinations.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolveStackLibrariesFromMarkdown } from "@theforge/shared-types";
import {
  callUiMcpToolText,
  type UiMcpConnection,
} from "../ui-mcp/ui-mcp-transport.util.js";

const RESOLVE_LIBRARY_TOOL = "resolve-library-id";
const QUERY_DOCS_TOOL = "query-docs";

/** Max chars per library snippet injected into LLM prompts. */
const MAX_SNIPPET_CHARS = 2_400;

@Injectable()
export class TechnologyDocsMcpClientService {
  private readonly logger = new Logger(TechnologyDocsMcpClientService.name);

  constructor(private readonly config: ConfigService) {}

  /** True when TECH_DOCS_MCP_URL is configured. */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>("TECH_DOCS_MCP_URL")?.trim());
  }

  /**
   * Builds a markdown block with official library docs for technologies detected in the MDD.
   * @returns null when MCP is not configured, no libraries detected, or all lookups fail.
   */
  async buildContextForMdd(mddContent: string, blueprintContent?: string | null): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const maxLibraries = this.readMaxLibraries();
    const combined = [mddContent, blueprintContent].filter(Boolean).join("\n\n");
    const candidates = resolveStackLibrariesFromMarkdown(combined, maxLibraries);
    if (candidates.length === 0) return null;

    const conn = this.connection();
    const sections: string[] = [];

    for (const candidate of candidates) {
      try {
        const snippet = await this.fetchLibrarySnippet(conn, candidate.libraryName, candidate.queryTopic);
        if (snippet?.trim()) {
          sections.push(`### ${candidate.label}\n\n${snippet.trim()}`);
        }
      } catch (e) {
        this.logger.warn(
          `[tech-docs] skip ${candidate.libraryName}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (sections.length === 0) return null;
    return sections.join("\n\n");
  }

  private connection(): UiMcpConnection {
    return {
      url: this.config.get<string>("TECH_DOCS_MCP_URL")?.trim() ?? "",
      token: this.config.get<string>("TECH_DOCS_MCP_TOKEN")?.trim() || null,
      timeoutMs: this.readTimeoutMs(),
    };
  }

  private readTimeoutMs(): number {
    const raw = this.config.get<string>("TECH_DOCS_MCP_TIMEOUT_MS");
    const n = raw ? Number.parseInt(raw, 10) : 15_000;
    return Number.isFinite(n) && n > 0 ? n : 15_000;
  }

  private readMaxLibraries(): number {
    const raw = this.config.get<string>("TECH_DOCS_MCP_MAX_LIBRARIES");
    const n = raw ? Number.parseInt(raw, 10) : 3;
    return Number.isFinite(n) && n > 0 ? Math.min(n, 6) : 3;
  }

  private async fetchLibrarySnippet(
    conn: UiMcpConnection,
    libraryName: string,
    queryTopic: string,
  ): Promise<string | null> {
    const libraryId = await this.resolveLibraryId(conn, libraryName, queryTopic);
    if (!libraryId) return null;
    const docs = await callUiMcpToolText(conn, QUERY_DOCS_TOOL, {
      libraryId,
      query: `SDD technical documentation: ${queryTopic}. Prefer API patterns, configuration, and best practices.`,
    });
    return capSnippet(docs);
  }

  private async resolveLibraryId(
    conn: UiMcpConnection,
    libraryName: string,
    queryTopic: string,
  ): Promise<string | null> {
    const text = await callUiMcpToolText(conn, RESOLVE_LIBRARY_TOOL, {
      libraryName,
      query: queryTopic,
    });
    if (!text?.trim()) return null;

    const explicit = text.match(/\/[a-z0-9._-]+\/[a-z0-9._-]+(?:\/[a-z0-9._-]+)?/i);
    if (explicit?.[0]) return explicit[0];

    try {
      const parsed = JSON.parse(text) as {
        libraryId?: string;
        id?: string;
        results?: Array<{ libraryId?: string; id?: string }>;
      };
      const direct = parsed.libraryId ?? parsed.id;
      if (typeof direct === "string" && direct.startsWith("/")) return direct;
      const first = parsed.results?.find(
        (r) => typeof r.libraryId === "string" || typeof r.id === "string",
      );
      const fromList = first?.libraryId ?? first?.id;
      if (typeof fromList === "string" && fromList.startsWith("/")) return fromList;
    } catch {
      /* plain-text response */
    }

    return null;
  }
}

function capSnippet(text: string | null): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (trimmed.length <= MAX_SNIPPET_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_SNIPPET_CHARS)}\n\n… (truncado)`;
}
