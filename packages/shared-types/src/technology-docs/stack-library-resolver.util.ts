/**
 * Detects technology libraries mentioned in MDD §2 / blueprint text for Technology Docs MCP lookups.
 */

export interface StackLibraryCandidate {
  /** Display label in generated context blocks. */
  label: string;
  /** Argument for Context7 `resolve-library-id.libraryName`. */
  libraryName: string;
  /** Focused query for `query-docs`. */
  queryTopic: string;
}

interface StackPattern {
  pattern: RegExp;
  candidate: StackLibraryCandidate;
}

const STACK_PATTERNS: StackPattern[] = [
  {
    pattern: /\bnest(?:\.?js)?\b/i,
    candidate: {
      label: "NestJS",
      libraryName: "nestjs",
      queryTopic: "modules, controllers, providers, guards, DTOs, validation pipes",
    },
  },
  {
    pattern: /\bprisma\b/i,
    candidate: {
      label: "Prisma",
      libraryName: "prisma",
      queryTopic: "schema, migrations, Prisma Client queries, relations",
    },
  },
  {
    pattern: /\bnext(?:\.?js)?\b/i,
    candidate: {
      label: "Next.js",
      libraryName: "next.js",
      queryTopic: "App Router, API routes, server components, middleware",
    },
  },
  {
    pattern: /\breact\b/i,
    candidate: {
      label: "React",
      libraryName: "react",
      queryTopic: "hooks, components, state, forms",
    },
  },
  {
    pattern: /\bbullmq\b|\bbull\b/i,
    candidate: {
      label: "BullMQ",
      libraryName: "bullmq",
      queryTopic: "queues, workers, jobs, Redis connection",
    },
  },
  {
    pattern: /\bzod\b/i,
    candidate: {
      label: "Zod",
      libraryName: "zod",
      queryTopic: "schemas, validation, parsing, TypeScript inference",
    },
  },
  {
    pattern: /\btanstack\s+query\b|\breact\s+query\b/i,
    candidate: {
      label: "TanStack Query",
      libraryName: "tanstack query",
      queryTopic: "useQuery, mutations, cache, query keys",
    },
  },
  {
    pattern: /\btypeorm\b/i,
    candidate: {
      label: "TypeORM",
      libraryName: "typeorm",
      queryTopic: "entities, migrations, repositories, relations",
    },
  },
  {
    pattern: /\bexpress\b/i,
    candidate: {
      label: "Express",
      libraryName: "express",
      queryTopic: "routing, middleware, error handling",
    },
  },
  {
    pattern: /\bvite\b/i,
    candidate: {
      label: "Vite",
      libraryName: "vite",
      queryTopic: "config, build, plugins, dev server",
    },
  },
  {
    pattern: /\btailwind(?:\s+css)?\b/i,
    candidate: {
      label: "Tailwind CSS",
      libraryName: "tailwindcss",
      queryTopic: "utility classes, config, responsive design",
    },
  },
  {
    pattern: /\blanggraph\b/i,
    candidate: {
      label: "LangGraph",
      libraryName: "langgraph",
      queryTopic: "StateGraph, nodes, edges, checkpoints",
    },
  },
  {
    pattern: /\bfastify\b/i,
    candidate: {
      label: "Fastify",
      libraryName: "fastify",
      queryTopic: "routes, plugins, schemas, hooks",
    },
  },
];

/**
 * Returns unique library candidates detected in markdown (typically MDD §2 or blueprint).
 * @param markdown - MDD, blueprint, or combined stack section
 * @param maxLibraries - cap to control MCP latency/token cost
 */
export function resolveStackLibrariesFromMarkdown(
  markdown: string,
  maxLibraries = 3,
): StackLibraryCandidate[] {
  const text = markdown?.trim() ?? "";
  if (!text) return [];

  const seen = new Set<string>();
  const out: StackLibraryCandidate[] = [];

  for (const { pattern, candidate } of STACK_PATTERNS) {
    if (!pattern.test(text)) continue;
    const key = candidate.libraryName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
    if (out.length >= maxLibraries) break;
  }

  return out;
}
