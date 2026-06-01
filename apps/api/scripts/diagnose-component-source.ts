/**
 * Dev-only: log component source MCP shapes (list_modules, resolve, catalog_health, previews).
 *
 * Usage (from repo root):
 *   pnpm exec tsx apps/api/scripts/diagnose-component-source.ts [userId]
 *
 * Requires DATABASE_URL and saved component-source config for the user (enabled + url + token).
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module.js";
import { ComponentSourceRegistry } from "../src/modules/component-source/component-source.registry.js";
import { runComponentSourceDiagnostic } from "../src/modules/component-source/component-source-diagnose.util.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

async function main() {
  const userIdArg = process.argv[2]?.trim();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const prisma = app.get(PrismaService);
    const registry = app.get(ComponentSourceRegistry);

    let userId = userIdArg;
    if (!userId) {
      const user = await prisma.user.findFirst({
        where: {
          componentSourceEnabled: true,
          componentSourceUrl: { not: null },
        },
        select: { id: true, email: true },
        orderBy: { updatedAt: "desc" },
      });
      if (!user) {
        console.error(
          "No user with component source enabled. Pass userId: tsx apps/api/scripts/diagnose-component-source.ts <uuid>",
        );
        process.exit(1);
      }
      userId = user.id;
      console.log(`Using user ${user.email ?? user.id}`);
    }

    const source = await registry.resolveForUser(userId);
    const report = await runComponentSourceDiagnostic(source, userId);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
