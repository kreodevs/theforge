import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** remark/rehype plugins for LaTeX in Workshop markdown preview ($…$ inline, $$…$$ display). */
export const markdownMathRemarkPlugins = [remarkMath] as const;
export const markdownMathRehypePlugins = [rehypeKatex] as const;

/** Tailwind selectors for KaTeX output inside `.markdown-preview`. */
export const MARKDOWN_KATEX_CLASS =
  "[&_.katex]:text-[var(--foreground)] [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:rounded-md [&_.katex-display]:border [&_.katex-display]:border-[var(--border)] [&_.katex-display]:bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] [&_.katex-display]:px-3 [&_.katex-display]:py-2";
