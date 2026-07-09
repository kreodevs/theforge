/**
 * Phase 0 / Benchmark — detect external API/doc topics and map them to Context7 lookups.
 */

import {
  resolveStackLibrariesFromMarkdown,
  type StackLibraryCandidate,
} from "./stack-library-resolver.util.js";

interface TopicPattern {
  pattern: RegExp;
  candidate: StackLibraryCandidate;
}

/** Signals that a gap or chat message may depend on external API / auth documentation. */
const EXTERNAL_DOC_SIGNAL_RE =
  /\b(?:PAT|personal access token|api\s+key|apikey|bearer\s+token|oauth|openid|jwt|json web token|webhook|access token|refresh token|client secret|service account|scopes?|authorization header|x-api-key)\b/i;

const VENDOR_TOPIC_PATTERNS: TopicPattern[] = [
  {
    pattern: /\b(?:PAT|personal access token)s?\b/i,
    candidate: {
      label: "Personal access tokens",
      libraryName: "github api",
      queryTopic: "personal access token format, scopes, authentication headers",
    },
  },
  {
    pattern: /\bapi\s+keys?\b/i,
    candidate: {
      label: "API keys",
      libraryName: "oauth 2.0",
      queryTopic: "API key and bearer token authentication best practices",
    },
  },
  {
    pattern: /\boauth\s*2?\.?0?\b|\bopenid\s+connect\b/i,
    candidate: {
      label: "OAuth 2.0",
      libraryName: "oauth 2.0",
      queryTopic: "authorization code flow, access tokens, refresh tokens, scopes",
    },
  },
  {
    pattern: /\bjwt\b|json web token/i,
    candidate: {
      label: "JWT",
      libraryName: "jsonwebtoken",
      queryTopic: "token structure, claims, signing algorithms, validation",
    },
  },
  {
    pattern: /\bwebhook?s?\b/i,
    candidate: {
      label: "Webhooks",
      libraryName: "webhooks",
      queryTopic: "webhook payload format, signature verification, retries, idempotency",
    },
  },
  {
    pattern: /\bbearer\s+token\b/i,
    candidate: {
      label: "Bearer tokens",
      libraryName: "oauth 2.0",
      queryTopic: "Authorization Bearer header format and usage",
    },
  },
  {
    pattern: /\bgithub\b/i,
    candidate: {
      label: "GitHub API",
      libraryName: "github api",
      queryTopic: "REST authentication, fine-grained PAT, classic PAT, rate limits",
    },
  },
  {
    pattern: /\bgitlab\b/i,
    candidate: {
      label: "GitLab API",
      libraryName: "gitlab api",
      queryTopic: "personal access tokens, project tokens, authentication",
    },
  },
  {
    pattern: /\bstripe\b/i,
    candidate: {
      label: "Stripe",
      libraryName: "stripe",
      queryTopic: "API keys, restricted keys, webhooks, authentication",
    },
  },
  {
    pattern: /\bslack\b/i,
    candidate: {
      label: "Slack API",
      libraryName: "slack api",
      queryTopic: "bot tokens, OAuth, signing secrets, webhooks",
    },
  },
  {
    pattern: /\bwhatsapp\b|\bwasender\b/i,
    candidate: {
      label: "WhatsApp Business API",
      libraryName: "whatsapp business api",
      queryTopic: "access tokens, webhooks, message API authentication",
    },
  },
  {
    pattern: /\bauth0\b/i,
    candidate: {
      label: "Auth0",
      libraryName: "auth0",
      queryTopic: "API authentication, machine-to-machine tokens, scopes",
    },
  },
  {
    pattern: /\bgoogle\s+(?:oauth|api)\b|\bgcp\b/i,
    candidate: {
      label: "Google OAuth / API",
      libraryName: "google oauth",
      queryTopic: "service account keys, OAuth 2.0 tokens, API keys",
    },
  },
];

const EXPLICIT_CONTEXT7_RE =
  /(?:seg[uú]n|consulta(?:r)?|usa(?:r)?|busca(?:r)?\s+en|mira\s+en|according\s+to|per)\s+context\s*7\b|\bcontext7\s*[,:]/i;

/** True when text likely needs external API / auth documentation (Phase 0 gaps or chat). */
export function shouldAutoFetchPhase0TechDocs(text: string): boolean {
  const t = text?.trim() ?? "";
  if (!t) return false;
  if (EXTERNAL_DOC_SIGNAL_RE.test(t)) return true;
  return VENDOR_TOPIC_PATTERNS.some(({ pattern }) => pattern.test(t));
}

/** User explicitly asks to consult Context7 in Workshop chat. */
export function isExplicitContext7ChatRequest(message: string): boolean {
  return EXPLICIT_CONTEXT7_RE.test((message ?? "").trim());
}

/** Strips meta-instructions and returns the technical question for Context7. */
export function extractExplicitContext7Query(message: string): string {
  const trimmed = (message ?? "").trim();
  if (!trimmed) return "";
  const stripped = trimmed
    .replace(/^.*?(?:seg[uú]n|consulta(?:r)?|usa(?:r)?|busca(?:r)?\s+en|according\s+to|per)\s+context\s*7\s*[,:]?\s*/i, "")
    .replace(/^context7\s*[,:]\s*/i, "")
    .trim();
  return stripped || trimmed;
}

/**
 * Resolves Context7 library candidates from Phase 0 / Benchmark text.
 * Merges stack detection (MDD §2 patterns) with auth/API/vendor topic patterns.
 */
export function resolveTechDocCandidatesFromText(
  text: string,
  maxLibraries = 3,
): StackLibraryCandidate[] {
  const t = text?.trim() ?? "";
  if (!t) return [];

  const seen = new Set<string>();
  const out: StackLibraryCandidate[] = [];

  const push = (candidate: StackLibraryCandidate) => {
    const key = candidate.libraryName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(candidate);
  };

  for (const c of resolveStackLibrariesFromMarkdown(t, maxLibraries)) {
    push(c);
    if (out.length >= maxLibraries) return out;
  }

  for (const { pattern, candidate } of VENDOR_TOPIC_PATTERNS) {
    if (!pattern.test(t)) continue;
    push(candidate);
    if (out.length >= maxLibraries) break;
  }

  return out;
}

/** Builds a focused query string from gap question, description, and user answer. */
export function buildPhase0TechDocsQueryText(parts: {
  question?: string | null;
  gapDescription?: string | null;
  answer?: string | null;
  extra?: string | null;
}): string {
  return [parts.question, parts.gapDescription, parts.answer, parts.extra]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}
