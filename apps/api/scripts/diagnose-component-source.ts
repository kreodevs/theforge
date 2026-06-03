/**
 * Dev-only: log component source MCP shapes (list_modules, resolve, catalog_health, previews).
 *
 * Usage (from repo root):
 *   pnpm exec tsx apps/api/scripts/diagnose-component-source.ts [projectId]
 *
 * Requires DATABASE_URL and a project with an assigned, confirmed component-source profile.
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module.js";
import { ComponentSourceRegistry } from "../src/modules/component-source/component-source.registry.js";
import { runComponentSourceDiagnostic } from "../src/modules/component-source/component-source-diagnose.util.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

async function main() {
  const projectIdArg = process.argv[2]?.trim();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const prisma = app.get(PrismaService);
    const registry = app.get(ComponentSourceRegistry);

    let projectId = projectIdArg;
    if (!projectId) {
      const project = await prisma.project.findFirst({
        where: {
          componentSourceProfileId: { not: null },
          componentSourceProfile: {
            mappingConfirmedAt: { not: null },
            url: { not: null },
          },
        },
        select: { id: true, name: true, userId: true },
        orderBy: { updatedAt: "desc" },
      });
      if (!project) {
        console.error(
          "No project with an active component source profile. Pass projectId: tsx apps/api/scripts/diagnose-component-source.ts <uuid>",
        );
        process.exit(1);
      }
      projectId = project.id;
      console.log(`Using project ${project.name ?? project.id}`);
    }

    const ctx = await registry.resolveForProject(projectId);
    if (!ctx.active) {
      console.error(
        "Project profile inactive or mapping not confirmed. Assign a profile with confirmed tool mapping in the workshop.",
      );
      process.exit(1);
    }

    const report = await runComponentSourceDiagnostic(ctx.port, ctx.ownerUserId);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
