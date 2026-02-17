
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { ProjectsService } from "../src/projects/projects.service";

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const projectsService = app.get(ProjectsService);

    const projectId = "3"; // Project ID from user context
    console.log(`Cleaning Spec content for project ${projectId}...`);

    try {
        const project = await projectsService.findOne(projectId);
        if (!project) {
            console.error("Project not found");
            process.exit(1);
        }

        const raw = project.specContent || "";
        console.log("Current content start:", raw.slice(0, 50).replace(/\n/g, "\\n"));

        const cleaned = raw
            .replace(/^\s*```(?:markdown)?\s*/i, "")
            .replace(/^\s*```\s*/, "")
            .replace(/\s*```\s*$/, "");

        if (raw !== cleaned) {
            await projectsService.update(projectId, { specContent: cleaned });
            console.log("Content cleaned and saved.");
            console.log("New content start:", cleaned.slice(0, 50).replace(/\n/g, "\\n"));
        } else {
            console.log("Content was already clean.");
        }
    } catch (error) {
        console.error("Error cleaning content:", error);
    } finally {
        await app.close();
    }
}

bootstrap();
