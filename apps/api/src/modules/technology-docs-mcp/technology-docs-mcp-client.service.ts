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
import {
  resolveStackLibrariesFromMarkdown,
  resolveTechDocCandidatesFromText,
  shouldAutoFetchPhase0TechDocs,
  type StackLibraryCandidate,
} from "@theforge/shared-types";
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

export type BuildTechDocsContextOptions = {
  userId?: string;
  maxLibraries?: number;
  /** When true, skip Phase 0 signal detection and fetch if any candidate matches. */
  force?: boolean;
};

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
    const combined = [mddContent, blueprintContent].filter(Boolean).join("\n\n");
    return this.buildContextFromText(combined, { force: true });
  }

  /**
   * Phase 0 / Benchmark — stack + auth/API/vendor topics from free text.
   * Skips when no external-doc signals unless `force: true`.
   */
  async buildContextFromText(
    text: string,
    options?: BuildTechDocsContextOptions,
  ): Promise<string | null> {
    const trimmed = text?.trim() ?? "";
    if (!trimmed) return null;

    const maxLibraries = options?.maxLibraries ?? this.readMaxLibraries();
    const candidates = resolveTechDocCandidatesFromText(trimmed, maxLibraries);
    if (candidates.length === 0) return null;

    if (!options?.force && !shouldAutoFetchPhase0TechDocs(trimmed)) {
      const stackOnly = resolveStackLibrariesFromMarkdown(trimmed, 1);
      if (stackOnly.length === 0) return null;
    }

    const conn = await this.resolveConnectionForOptions(options);
    if (!conn) return null;

    return this.fetchSectionsFromCandidates(conn, candidates, "SDD technical documentation");
  }

  /**
   * Explicit Context7 lookup from Workshop chat (e.g. "Según Context7, …").
   */
  async buildContextForExplicitQuery(
    query: string,
    userId?: string,
  ): Promise<string | null> {
    const q = query?.trim() ?? "";
    if (!q) return null;

    const conn = userId
      ? await this.resolveConnectionForUser(userId)
      : await this.resolveConnection();
    if (!conn) return null;

    const maxLibraries = Math.min(this.readMaxLibraries(), 2);
    const candidates = resolveTechDocCandidatesFromText(q, maxLibraries);

    if (candidates.length === 0) {
      const snippet = await this.fetchLibrarySnippet(
        conn,
        "api authentication",
        q,
        "Phase 0 integration documentation",
      );
      return snippet ? `### Context7\n\n${snippet.trim()}` : null;
    }

    const sections: string[] = [];
    for (const candidate of candidates) {
      try {
        const topic = q.length >= 24 ? q : candidate.queryTopic;
        const snippet = await this.fetchLibrarySnippet(
          conn,
          candidate.libraryName,
          topic,
          "Phase 0 integration documentation",
        );
        if (snippet?.trim()) {
          sections.push(`### ${candidate.label} (Context7)\n\n${snippet.trim()}`);
        }
      } catch (e) {
        this.logger.warn(
          `[tech-docs] explicit skip ${candidate.libraryName}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return sections.length > 0 ? sections.join("\n\n") : null;
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

  private async resolveConnectionForOptions(
    options?: BuildTechDocsContextOptions,
  ): Promise<UiMcpConnection | null> {
    if (options?.userId?.trim()) {
      return this.resolveConnectionForUser(options.userId.trim());
    }
    return this.resolveConnection();
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

  private async fetchSectionsFromCandidates(
    conn: UiMcpConnection,
    candidates: StackLibraryCandidate[],
    docKind: string,
  ): Promise<string | null> {
    const sections: string[] = [];

    for (const candidate of candidates) {
      try {
        const snippet = await this.fetchLibrarySnippet(
          conn,
          candidate.libraryName,
          candidate.queryTopic,
          docKind,
        );
        if (snippet?.trim()) {
          sections.push(`### ${candidate.label}\n\n${snippet.trim()}`);
        }
      } catch (e) {
        this.logger.warn(
          `[tech-docs] skip ${candidate.libraryName}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return sections.length > 0 ? sections.join("\n\n") : null;
  }

  private async fetchLibrarySnippet(
    conn: UiMcpConnection,
    libraryName: string,
    queryTopic: string,
    docKind = "SDD technical documentation",
  ): Promise<string | null> {
    const libraryId = await this.resolveLibraryId(conn, libraryName, queryTopic);
    if (!libraryId) return null;
    const docs = await callUiMcpToolText(conn, QUERY_DOCS_TOOL, {
      libraryId,
      query: `${docKind}: ${queryTopic}. Prefer API patterns, configuration, token formats, and best practices.`,
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
