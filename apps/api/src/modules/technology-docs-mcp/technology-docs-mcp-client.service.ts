/**
 * @fileoverview Technology Docs MCP — optional Context7-compatible documentation enrichment.
 *
 * Credentials live on **User** (Ajustes → Documentación técnica), not platform env.
 * When the user has no API key or MCP is unreachable, all methods no-op (null).
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolveStackLibrariesFromMarkdown } from "@theforge/shared-types";
import { getRequestUserId } from "../../common/request-user.store.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  callUiMcpToolText,
  type UiMcpConnection,
} from "../ui-mcp/ui-mcp-transport.util.js";

const RESOLVE_LIBRARY_TOOL = "resolve-library-id";
const QUERY_DOCS_TOOL = "query-docs";

/** Context7 hosted MCP (remote). Users override URL in Settings if needed. */
export const DEFAULT_TECH_DOCS_MCP_URL = "https://mcp.context7.com/mcp";

/** Max chars per library snippet injected into LLM prompts. */
const MAX_SNIPPET_CHARS = 2_400;

@Injectable()
export class TechnologyDocsMcpClientService {
  private readonly logger = new Logger(TechnologyDocsMcpClientService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Builds a markdown block with official library docs for technologies detected in the MDD.
   * @returns null when user has no API key, no libraries detected, or all lookups fail.
   */
  async buildContextForMdd(mddContent: string, blueprintContent?: string | null): Promise<string | null> {
    const conn = await this.resolveConnection();
    if (!conn) return null;

    const maxLibraries = this.readMaxLibraries();
    const combined = [mddContent, blueprintContent].filter(Boolean).join("\n\n");
    const candidates = resolveStackLibrariesFromMarkdown(combined, maxLibraries);
    if (candidates.length === 0) return null;

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

  /** Resolves MCP connection for the authenticated user (Context7 API key per user). */
  async resolveConnectionForUser(userId: string): Promise<UiMcpConnection | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { techDocsMcpUrl: true, techDocsMcpToken: true },
    });
    const apiKey = user?.techDocsMcpToken?.trim();
    if (!apiKey) return null;

    const url =
      user?.techDocsMcpUrl?.trim() ||
      this.config.get<string>("TECH_DOCS_MCP_DEFAULT_URL")?.trim() ||
      DEFAULT_TECH_DOCS_MCP_URL;

    return {
      url,
      token: null,
      extraHeaders: { CONTEXT7_API_KEY: apiKey },
      timeoutMs: this.readTimeoutMs(),
    };
  }

  private async resolveConnection(): Promise<UiMcpConnection | null> {
    try {
      const userId = getRequestUserId();
      return this.resolveConnectionForUser(userId);
    } catch {
      return null;
    }
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
