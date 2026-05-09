import { useEffect, useState } from "react";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  TooltipProvider,
} from "@/components/ui";
import { LoginFooter } from "@/components/LoginFooter";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { cn } from "@/lib/utils";
import { API_BASE, setAccessToken } from "@/utils/apiClient";

interface LoginViewProps {
  onLoggedIn: () => void;
}

type Step = "send" | "code" | "sso";

/** Brand block inside the login card (above the email field). */
function LoginCardBrandBlock() {
  return (
    <div className="flex flex-col items-center gap-3 border-b border-[var(--border)] pb-5 text-center sm:gap-4 sm:pb-6">
      <div className="relative shrink-0">
        <img
          src="/favicon.svg?v=3"
          alt=""
          width={72}
          height={72}
          decoding="async"
          className={cn(
            "size-16 select-none rounded-2xl sm:size-[4.5rem]",
            "shadow-[var(--shadow-md)]",
            "ring-1 ring-[color-mix(in_oklch,var(--foreground)_8%,transparent)]",
            "dark:ring-[color-mix(in_oklch,var(--foreground)_14%,transparent)]",
          )}
        />
      </div>
      <div className="flex w-full max-w-[min(100%,22rem)] flex-col items-center gap-2 sm:max-w-none sm:gap-2.5">
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-[1.65rem] md:text-[1.8rem]">
          The Forge
        </h1>
        <p className="px-1 text-[14px] leading-snug text-[var(--foreground-muted)] sm:px-0 sm:text-[15px]">
          Ingresa tu correo registrado para recibir el código de acceso.
        </p>
        <div
          className={cn(
            "inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-[var(--border)]",
            "bg-[color-mix(in_oklch,var(--card)_88%,var(--muted))] px-3 py-1.5 text-center text-[12px] font-medium leading-snug sm:px-3.5 sm:py-2 sm:text-[13px] sm:leading-none",
            "text-[var(--foreground-muted)] backdrop-blur-[2px]",
          )}
        >
          <ShieldCheck className="size-4 shrink-0 text-[var(--primary)] opacity-90" aria-hidden />
          Acceso sin contraseña
        </div>
      </div>
    </div>
  );
}

/**
 * Email OTP + optional SSO entry. Layout uses theme tokens only (light/dark).
 */
export default function LoginView({ onLoggedIn }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("send");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    const ssoUrl = import.meta.env.VITE_SSO_URL as string;
    if (ssoUrl?.trim()) {
      setSsoEnabled(true);
    }

    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    if (ssoToken) {
      handleSsoLogin(ssoToken);
    }
  }, []);

  async function handleSsoLogin(token: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/auth/sso/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (!r.ok || !data.accessToken) {
        throw new Error(data.message ?? "Error SSO");
      }
      setAccessToken(data.accessToken);
      window.history.replaceState({}, "", window.location.pathname);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error SSO");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Email requerido");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(
          typeof err.message === "string" ? err.message : "No se pudo enviar el código",
        );
      }
      setEmail(normalized);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        accessToken?: string;
        message?: string | string[];
      };
      if (!r.ok) {
        const msg = data.message;
        const text = Array.isArray(msg) ? msg.join(", ") : msg;
        throw new Error(text ?? "Código incorrecto");
      }
      if (typeof data.accessToken !== "string") {
        throw new Error("Respuesta inválida del servidor");
      }
      setAccessToken(data.accessToken);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="relative min-h-[100dvh] overflow-hidden text-[var(--foreground)]">
      {/* Base wash — avoids a flat white screen in light mode */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(165deg,color-mix(in_oklch,var(--primary)_18%,var(--muted))_0%,var(--background)_38%,color-mix(in_oklch,var(--chart-2)_14%,var(--background))_72%,var(--background)_100%)]"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-90 dark:opacity-70">
        <div className="absolute -left-[20%] top-[8%] h-[min(520px,55vh)] w-[min(520px,70vw)] rounded-full bg-[color-mix(in_oklch,var(--primary)_42%,transparent)] blur-[72px]" />
        <div className="absolute -right-[12%] bottom-[5%] h-[min(440px,48vh)] w-[min(440px,62vw)] rounded-full bg-[color-mix(in_oklch,var(--chart-2)_32%,transparent)] blur-[80px]" />
        <div className="absolute left-1/2 top-[48%] h-[min(360px,40vh)] w-[min(480px,85vw)] -translate-x-1/2 rounded-full bg-[color-mix(in_oklch,var(--chart-5)_22%,transparent)] blur-[96px] dark:bg-[color-mix(in_oklch,var(--primary)_18%,transparent)]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_-25%,color-mix(in_oklch,var(--primary)_26%,transparent),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.55] dark:opacity-[0.38]"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklch, var(--foreground) 11%, transparent) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-[20] sm:right-6 sm:top-6">
        <ThemeModeToggle variant="surface" compact />
      </div>
      <div className="relative z-[1] flex min-h-[100dvh] flex-col">
        <div
          className={cn(
            "flex flex-1 flex-col items-center justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
            "pt-[max(4.25rem,calc(env(safe-area-inset-top)+3.25rem))] sm:p-10 sm:pb-8 sm:pt-14",
          )}
        >
          <div
            className={cn(
              "flex w-full max-w-lg flex-col gap-4 sm:gap-5",
              "animate-in fade-in-0 zoom-in-95 duration-300",
            )}
          >
          {step === "send" ? (
            <form onSubmit={requestOtp} className="flex flex-col gap-4 sm:gap-5">
              <Card variant="elevated" className="border-[var(--border)] shadow-[var(--shadow-lg)]">
                <div
                  aria-hidden
                  className="h-1 w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklch,var(--primary)_85%,transparent)] to-transparent"
                />
                <CardContent className="space-y-5 px-4 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
                  <LoginCardBrandBlock />
                  <div className="space-y-2">
                    <label
                      htmlFor="login-email"
                      className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]"
                    >
                      Correo corporativo
                    </label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                        aria-hidden
                      />
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="next"
                        placeholder="tu@empresa.com"
                        value={email}
                        onChange={(ev) => setEmail(ev.target.value)}
                        disabled={loading}
                        required
                        className="h-11 bg-[var(--card)] pl-10 text-base md:text-sm"
                      />
                    </div>
                  </div>
                  {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
                  {ssoEnabled ? (
                    <>
                      <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-[var(--border)]" />
                        </div>
                        <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.12em]">
                          <span className="bg-[var(--card)] px-3 text-[var(--foreground-muted)]">
                            O continúa con
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_100%,transparent)]"
                        onClick={() => {
                          const ssoUrl = import.meta.env.VITE_SSO_URL as string;
                          if (ssoUrl) window.location.href = ssoUrl;
                        }}
                        disabled={loading}
                      >
                        Iniciar sesión con SSO
                      </Button>
                    </>
                  ) : null}
                </CardContent>
                <CardFooter className="border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))] px-4 py-3.5 sm:px-8 sm:py-4">
                  <p className="w-full text-center text-[11px] leading-relaxed text-[var(--foreground-muted)]">
                    Solo cuentas autorizadas reciben un código. Revisa spam si no ves el correo en unos minutos.
                  </p>
                </CardFooter>
              </Card>
              <Button
                type="submit"
                size="lg"
                className={cn(
                  "h-12 w-full touch-manipulation gap-2 text-base font-semibold",
                  "shadow-[var(--shadow-md),var(--shadow-gold)]",
                )}
                disabled={loading || !email.trim()}
              >
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Enviar código
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="flex flex-col gap-4 sm:gap-5">
              <Card variant="elevated" className="border-[var(--border)] shadow-[var(--shadow-lg)]">
                <div
                  aria-hidden
                  className="h-1 w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklch,var(--primary)_85%,transparent)] to-transparent"
                />
                <CardContent className="space-y-5 px-4 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
                  <div
                    className={cn(
                      "rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))]",
                      "px-4 py-3 shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--foreground)_6%,transparent)]",
                    )}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                      Código enviado a
                    </p>
                    <p className="mt-1 truncate font-medium text-[var(--foreground)]">{email}</p>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="code"
                      className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]"
                    >
                      Código de 6 dígitos
                    </label>
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                        aria-hidden
                      />
                      <Input
                        id="code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="done"
                        placeholder="000000"
                        maxLength={6}
                        pattern="\d{6}"
                        value={code}
                        onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        className="h-11 bg-[var(--card)] pl-10 font-mono text-lg tracking-[0.35em] md:text-base"
                      />
                    </div>
                  </div>
                  {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
                </CardContent>
                <CardFooter className="border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))] px-4 py-3.5 sm:px-8 sm:py-4">
                  <p className="w-full text-center text-[11px] leading-relaxed text-[var(--foreground-muted)]">
                    El código caduca tras unos minutos. Puedes solicitar uno nuevo volviendo atrás.
                  </p>
                </CardFooter>
              </Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-12 flex-1 touch-manipulation border-[var(--border)] bg-[color-mix(in_oklch,var(--card)_88%,transparent)]",
                    "shadow-[var(--shadow-sm)] backdrop-blur-sm",
                  )}
                  onClick={() => {
                    setStep("send");
                    setCode("");
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Volver
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className={cn(
                    "h-12 flex-[1.15] touch-manipulation gap-2 font-semibold",
                    "shadow-[var(--shadow-md),var(--shadow-gold)]",
                  )}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Entrar
                </Button>
              </div>
            </form>
          )}
          </div>
        </div>
        <LoginFooter />
      </div>
    </div>
    </TooltipProvider>
  );
}
