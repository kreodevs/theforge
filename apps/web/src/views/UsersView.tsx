import { Shield } from "lucide-react";
import { UsersList } from "@/components/UsersList";
import { Card, CardContent } from "@/components/ui";

/** Vista de administración de usuarios (solo admin). Renderizada dentro del layout con sidebar (`App.tsx`). */
export default function UsersView() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-[min(100%,88rem)] shrink-0 px-4 pt-6 sm:px-6 lg:px-8 xl:px-10">
        <header className="mx-auto max-w-4xl pb-4 sm:pb-6">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--primary)] sm:text-3xl">
              <Shield className="h-8 w-8 shrink-0" />
              Usuarios
            </h1>
            <p className="mt-1 text-sm text-[var(--foreground-muted)] sm:text-base">
              Alta de usuarios, roles y API keys MCP por cuenta.
            </p>
          </div>
        </header>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[min(100%,88rem)] px-4 pb-6 sm:px-6 lg:px-8 xl:px-10">
          <div className="mx-auto max-w-4xl">
            <Card variant="ghost">
              <CardContent>
                <UsersList />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
