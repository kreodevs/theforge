import { useEffect } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import workshopManualMd from "../content/workshop-manual.md?raw";

type WorkshopHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

const mdComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1 className="text-xl font-semibold text-amber-400 mt-2 mb-3 border-b border-zinc-700 pb-2" {...props} />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="text-base font-semibold text-amber-400/95 mt-6 mb-2 first:mt-0" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="text-sm font-medium text-zinc-200 mt-4 mb-1.5" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => <p className="text-zinc-300 leading-relaxed mb-3 last:mb-0" {...props} />,
  ul: (props: ComponentPropsWithoutRef<"ul">) => <ul className="list-disc pl-5 space-y-1.5 mb-3 text-zinc-300" {...props} />,
  ol: (props: ComponentPropsWithoutRef<"ol">) => <ol className="list-decimal pl-5 space-y-1.5 mb-3 text-zinc-300" {...props} />,
  li: (props: ComponentPropsWithoutRef<"li">) => <li className="leading-relaxed" {...props} />,
  strong: (props: ComponentPropsWithoutRef<"strong">) => <strong className="font-semibold text-zinc-100" {...props} />,
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code className="rounded bg-zinc-800 px-1 py-0.5 text-[0.85em] text-amber-200/90" {...props} />
  ),
  hr: () => <hr className="my-6 border-zinc-700" />,
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto mb-4 rounded border border-zinc-700">
      <table className="w-full text-xs text-left border-collapse" {...props} />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<"thead">) => <thead className="bg-zinc-800/80" {...props} />,
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th className="border border-zinc-700 px-2 py-1.5 font-medium text-zinc-200" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border border-zinc-700 px-2 py-1.5 text-zinc-300 align-top" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a className="text-amber-400 hover:underline" target="_blank" rel="noreferrer" {...props} />
  ),
};

export default function WorkshopHelpModal({ open, onClose }: WorkshopHelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workshop-help-title"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[min(90vh,900px)] rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-700 shrink-0">
          <h2 id="workshop-help-title" className="text-lg font-semibold text-amber-400">
            Ayuda — Workshop
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            aria-label="Cerrar ayuda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 pr-3 scroll-smooth">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {workshopManualMd}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
