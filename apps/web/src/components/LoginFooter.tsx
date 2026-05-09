/**
 * @fileoverview Login page footer: brand + legal links, contributor face pile with profile tooltips.
 */
import { useEffect, useMemo, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Github, Linkedin, Scale } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  APACHE_LICENSE_URL,
  FORGE_GITHUB_URL,
  PROJECT_CONTRIBUTORS,
  type ProjectContributor,
} from "@/constants/projectMeta";
import { cn } from "@/lib/utils";
import {
  fetchGithubAvatarUrl,
  getContributorAvatarUrlSync,
  gravatarAvatarUrl,
  parseMailtoEmail,
} from "@/utils/contributorAvatar";

function getPrimaryProfileUrl(contributor: ProjectContributor): string {
  return (
    contributor.profileUrl ?? contributor.githubUrl ?? contributor.linkedinUrl ?? "#"
  );
}

function ContributorInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex size-full items-center justify-center bg-[color-mix(in_oklch,var(--primary)_22%,var(--muted))] text-[9px] font-semibold text-[var(--foreground)]">
      {initials || "?"}
    </span>
  );
}

function ContributorAvatar({
  contributor,
  className,
}: {
  contributor: ProjectContributor;
  className?: string;
}) {
  const email = useMemo(
    () => parseMailtoEmail(contributor.profileUrl),
    [contributor.profileUrl],
  );

  const [src, setSrc] = useState<string | undefined>(() =>
    getContributorAvatarUrlSync(contributor),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setSrc(getContributorAvatarUrlSync(contributor));
  }, [contributor]);

  useEffect(() => {
    const override = contributor.avatarUrl?.trim();
    const gh = contributor.githubUsername?.trim();
    if (override || !gh) return;
    let cancelled = false;
    fetchGithubAvatarUrl(gh).then((url) => {
      if (cancelled) return;
      if (url) setSrc(url);
      else if (email) setSrc(gravatarAvatarUrl(email));
    });
    return () => {
      cancelled = true;
    };
  }, [contributor.avatarUrl, contributor.githubUsername, contributor.id, email]);

  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        "relative block size-7 shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--background)] sm:size-8 md:size-9",
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          width={36}
          height={36}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ContributorInitials name={contributor.name} />
      )}
    </span>
  );
}

function ContributorFace({
  contributor,
  stackIndex,
}: {
  contributor: ProjectContributor;
  stackIndex: number;
}) {
  const primaryHref = getPrimaryProfileUrl(contributor);
  const githubTooltipHref =
    contributor.githubUrl?.trim() ??
    (contributor.githubUsername?.trim()
      ? `https://github.com/${contributor.githubUsername.trim()}`
      : undefined);
  const hasGithub = Boolean(githubTooltipHref);
  const hasLinkedIn = Boolean(contributor.linkedinUrl?.trim());

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <a
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "relative inline-flex rounded-full outline-none transition-transform duration-150",
            "hover:z-[60] hover:-translate-y-0.5 focus-visible:z-[60] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
          )}
          style={{ zIndex: 10 + stackIndex }}
          aria-label={`${contributor.name} — ${contributor.role}`}
        >
          <ContributorAvatar contributor={contributor} />
        </a>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={10}
        className={cn(
          "max-w-[min(17rem,calc(100vw-2rem))] rounded-xl border-zinc-700/90 bg-zinc-900 px-0 py-0 text-zinc-50 shadow-xl",
          "dark:border-zinc-600 dark:bg-zinc-950",
        )}
      >
        <div className="flex items-start gap-3 px-3.5 py-3 pr-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-semibold leading-tight text-white">{contributor.name}</p>
            <p className="text-[11px] leading-snug text-zinc-400">{contributor.role}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {hasGithub ? (
              <a
                href={githubTooltipHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={`GitHub de ${contributor.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Github className="size-4" aria-hidden />
              </a>
            ) : null}
            {hasLinkedIn ? (
              <a
                href={contributor.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={`LinkedIn de ${contributor.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Linkedin className="size-4" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
        <TooltipPrimitive.Arrow className="fill-zinc-900 dark:fill-zinc-950" width={14} height={7} />
      </TooltipContent>
    </Tooltip>
  );
}

const footerLinkClass = cn(
  "inline-flex items-center gap-2 rounded-[var(--radius-md)] font-medium text-[var(--foreground-muted)] transition-colors",
  "hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
);

export function LoginFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "relative z-[2] mt-auto border-t border-[var(--border)]",
        "bg-[color-mix(in_oklch,var(--card)_72%,transparent)] backdrop-blur-md",
        "py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:py-3.5 md:pl-6 md:pr-6",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-2 text-center lg:text-left">
          <p className="mx-auto max-w-lg text-[10px] leading-snug text-[var(--foreground-muted)] sm:text-[11px] lg:mx-0">
            © {year} The Forge. Apache License 2.0. Código abierto en GitHub.
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs lg:justify-start"
            aria-label="Enlaces del proyecto"
          >
            <a href={FORGE_GITHUB_URL} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
              <Github className="size-4 shrink-0" aria-hidden />
              Código en GitHub
            </a>
            <a href={APACHE_LICENSE_URL} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
              <Scale className="size-4 shrink-0" aria-hidden />
              Licencia Apache 2.0
            </a>
          </nav>
        </div>

        <div className="flex flex-col gap-1.5 lg:items-end">
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--foreground-muted)] lg:text-right">
            Colaboradores y autores
          </p>
          <ul
            className={cn(
              "flex max-w-[calc(100vw-2rem)] list-none flex-row flex-nowrap items-center justify-center gap-0 overflow-x-auto overflow-y-visible overscroll-x-contain py-1 pl-0.5 [-webkit-overflow-scrolling:touch]",
              "[scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_40%,transparent)_transparent]",
              "sm:max-w-none lg:flex-wrap lg:justify-end lg:overflow-visible lg:overscroll-auto lg:pb-0",
            )}
          >
            {PROJECT_CONTRIBUTORS.map((contributor, index) => (
              <li key={contributor.id} className={cn("-ml-2 shrink-0 first:ml-0 sm:-ml-2.5")}>
                <ContributorFace contributor={contributor} stackIndex={index} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
