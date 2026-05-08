import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Quita comillas envoltorio que a veces vienen en `.env` / Dokploy. */
function stripEnvQuotes(s: string | undefined): string | undefined {
  if (s == null) return undefined;
  let t = s.trim();
  if (t.length >= 2) {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      t = t.slice(1, -1);
    }
  }
  return t;
}

/**
 * En cada arranque, si `BOOTSTRAP_ADMIN_EMAILS` está definida, fuerza `role = admin`
 * para esos emails (solo filas existentes en `User`). Idempotente; pensado para Dokploy/deploy.
 */
@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const raw = stripEnvQuotes(this.config.get<string>("BOOTSTRAP_ADMIN_EMAILS"));
    if (!raw?.trim()) return;

    const emails = [
      ...new Set(
        raw
          .split(",")
          .map((e) => normalizeEmail(e))
          .filter((e) => e.length > 0 && e.includes("@")),
      ),
    ];
    if (emails.length === 0) return;

    const result = await this.prisma.user.updateMany({
      where: { email: { in: emails } },
      data: { role: "admin" },
    });

    if (result.count > 0) {
      this.logger.log(`BOOTSTRAP_ADMIN_EMAILS: promoted ${result.count} user(s) to admin`);
    } else {
      this.logger.warn(
        "BOOTSTRAP_ADMIN_EMAILS is set but no matching User rows were updated (emails not found yet?)",
      );
    }
  }
}
