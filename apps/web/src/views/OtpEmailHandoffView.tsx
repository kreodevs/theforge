import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Flame } from "lucide-react";
import { Button } from "@/components/ui";
import { LoginScreenChrome } from "@/components/login/LoginChrome";
import { cn } from "@/lib/utils";

function readOtpHandoffParams(): { email: string; code: string } {
  const params = new URLSearchParams(window.location.search);
  const email = (params.get("email") ?? "").trim().toLowerCase();
  const code = (params.get("otp") ?? params.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
  return { email, code };
}

export default function OtpEmailHandoffView() {
  const { email, code } = useMemo(() => readOtpHandoffParams(), []);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [autoCopyAttempted, setAutoCopyAttempted] = useState(false);

  const handleCopyCode = useCallback(async () => {
    if (code.length !== 6) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopyError("No se pudo copiar automáticamente. Selecciona el código y cópialo manualmente.");
    }
  }, [code]);

  useEffect(() => {
    if (autoCopyAttempted || code.length !== 6) return;
    setAutoCopyAttempted(true);
    void (async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        window.setTimeout(() => {
          const params = new URLSearchParams();
          if (email) params.set("email", email);
          const query = params.toString();
          window.location.href = query ? `/?${query}` : "/";
        }, 900);
      } catch {
        setCopyError("No se pudo copiar automáticamente. Pulsa «Copiar código» o selecciónalo del correo.");
      }
    })();
  }, [autoCopyAttempted, code, email]);

  function handleContinueToLogin() {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    const query = params.toString();
    window.location.href = query ? `/?${query}` : "/";
  }

  const invalid = code.length !== 6;

  return (
    <LoginScreenChrome>
      <div className="mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col justify-center pb-8">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--card-border)] bg-[var(--card)]",
            "shadow-[var(--shadow-lg)]",
          )}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[3px] bg-gradient-to-r from-transparent via-[color-mix(in_oklch,var(--primary)_88%,white)] to-transparent"
            aria-hidden
          />
          <div className="relative z-[3] px-6 py-8 text-center md:px-8">
            <div className="mb-5 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-white shadow-sm dark:bg-[var(--popover)]">
                <Flame className="h-7 w-7 text-[var(--primary)]" fill="currentColor" fillOpacity={0.9} aria-hidden />
              </div>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Tu código de acceso</h1>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              {invalid
                ? "El enlace no incluye un código válido. Solicita uno nuevo desde el login."
                : "Copia el código y pégalo en la pantalla de inicio de sesión de The Forge."}
            </p>

            {!invalid ? (
              <>
                <p
                  className="mx-auto mt-6 max-w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] px-4 py-5 font-mono text-3xl font-bold tracking-[0.38em] text-[var(--foreground)]"
                  aria-label={`Código de acceso: ${code}`}
                >
                  {code}
                </p>

                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    type="button"
                    variant={copied ? "outline" : "default"}
                    className="h-11 w-full rounded-xl font-semibold"
                    onClick={() => void handleCopyCode()}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden />
                        Código copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden />
                        Copiar código
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl"
                    onClick={handleContinueToLogin}
                  >
                    Ir al login
                  </Button>
                </div>

                {copyError ? <p className="mt-3 text-sm text-[var(--destructive)]">{copyError}</p> : null}
                {copied ? (
                  <p className="mt-3 text-sm text-[var(--foreground-muted)]">
                    Ya puedes pegar el código en el campo de 6 dígitos.
                  </p>
                ) : null}
              </>
            ) : (
              <Button type="button" className="mt-6 h-11 w-full rounded-xl" onClick={() => { window.location.href = "/"; }}>
                Volver al login
              </Button>
            )}
          </div>
        </div>
      </div>
    </LoginScreenChrome>
  );
}
