import { useMemo, useState } from "react";
import { FileJson, Copy, Check } from "lucide-react";
import { Button } from "./ui";
import { DocEmptyState } from "./DocEmptyState";
import { cn } from "@/lib/utils";

interface JsonDocPanelProps {
  content: string | null;
  title: string;
}

export function JsonDocPanel({ content, title }: JsonDocPanelProps) {
  const [parsed, error, formatted] = useMemo(() => {
    if (!content) return [null, null, ""];
    try {
      const obj = JSON.parse(content);
      const pretty = JSON.stringify(obj, null, 2);
      return [obj, null, pretty];
    } catch (e) {
      return [null, String(e), content];
    }
  }, [content]);

  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!formatted) return;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!content) {
    return (
      <DocEmptyState
        icon={FileJson}
        title={title}
        description="No hay datos disponibles. Genera el MDD para derivar este artefacto."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileJson className="w-4 h-4" />
          <span>{title}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={copyToClipboard}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <pre className={cn(
            "text-xs font-mono leading-relaxed",
            "text-foreground/90"
          )}>
            {formatted}
          </pre>
        )}
      </div>
    </div>
  );
}
