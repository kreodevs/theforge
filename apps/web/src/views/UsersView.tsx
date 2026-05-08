import { ArrowLeft, Shield } from "lucide-react";
import { UsersList } from "@/components/UsersList";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

interface UsersViewProps {
  onBack: () => void;
}

/** Vista dedicada de administración de usuarios (solo admin). Reemplaza el modal anterior. */
export default function UsersView({ onBack }: UsersViewProps) {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] px-4 py-6 sm:p-6 lg:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="border-b border-[var(--border)] pb-4 sm:pb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-start min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="shrink-0 touch-manipulation min-h-[44px] sm:min-h-9 gap-2 self-start"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a proyectos
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--primary)] flex items-center gap-2">
                <Shield className="w-8 h-8 shrink-0" />
                Usuarios
              </h1>
              <p className="text-[var(--foreground-muted)] mt-1 text-sm sm:text-base">
                Alta de usuarios, roles y API keys MCP por cuenta.
              </p>
            </div>
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
