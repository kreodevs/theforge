import { Shield } from "lucide-react";
import { UsersList } from "@/components/UsersList";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

/** Vista de administración de usuarios (solo admin). Renderizada dentro del layout con sidebar (`App.tsx`). */
export default function UsersView() {
  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] space-y-6 px-4 py-6 text-[var(--foreground)] sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b border-[var(--border)] pb-4 sm:pb-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
            <CardDescription>
              No puedes eliminar tu cuenta ni bajar tu rol desde aquí; usa otro administrador si aplica.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[min(70vh,100dvh-16rem)] overflow-y-auto">
            <UsersList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
