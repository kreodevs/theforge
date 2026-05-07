import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import workshopManualMd from "../content/workshop-manual.md?raw";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type WorkshopHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

const mdComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="mt-2 border-b border-[var(--border)] pb-2 text-xl font-semibold text-[var(--foreground)] first:mt-0"
      {...props}
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-6 text-base font-semibold text-[var(--primary)] first:mt-0"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-4 text-sm font-medium text-[var(--foreground)]" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="mb-3 text-sm leading-relaxed text-[var(--foreground-muted)] last:mb-0 sm:text-[15px]" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[var(--foreground-muted)]" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[var(--foreground-muted)]" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => <li className="leading-relaxed" {...props} />,
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-[var(--foreground)]" {...props} />
  ),
  code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code">) => {
    const isBlock = Boolean(className?.startsWith("language-"));
    if (isBlock) {
      return (
        <code className={cn("font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-[calc(var(--radius)-2px)] border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[0.85em] text-[var(--foreground)]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="mb-4 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] p-4 text-sm leading-relaxed text-[var(--foreground)] shadow-sm [scrollbar-color:var(--muted-foreground)_transparent]"
      {...props}
    />
  ),
  hr: () => <hr className="my-6 border-[var(--border)]" />,
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="mb-4 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_82%,var(--background))] shadow-sm [&_tbody_tr:last-child_td]:border-b-0">
      <table className="w-full border-collapse text-left text-xs" {...props} />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]" {...props} />
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium text-[var(--foreground)]" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border-b border-[var(--border)] px-3 py-2.5 align-top text-[var(--foreground-muted)]" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-[var(--primary)] underline-offset-2 hover:underline"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
};

export default function WorkshopHelpModal({ open, onClose }: WorkshopHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showClose
        className={cn(
          "flex max-h-[min(90vh,900px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0",
          "border-[var(--border)] bg-[var(--card)] sm:rounded-[var(--radius)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-[var(--border)] px-6 pb-4 pt-6 pr-14 text-left">
          <DialogTitle id="workshop-help-title">Ayuda — Workshop</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scroll-smooth [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_55%,transparent)_transparent]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {workshopManualMd}
          </ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
