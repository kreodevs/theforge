
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { AiAnalysisService, StreamMddManagerEvent } from "../src/modules/ai-analysis/ai-analysis.service";
import * as readline from "node:readline"; // Keep for legacy if needed, but clack is preferred
import { Logger } from "@nestjs/common";
import { intro, outro, text, select, spinner, isCancel, note } from "@clack/prompts";
import pc from "picocolors";
import * as path from "node:path";
import * as fs from "node:fs";

// Polyfill for chalk using picocolors to minimize dependencies if chalk is not mapped
const chalk = {
    inverse: pc.inverse,
    red: pc.red,
    green: pc.green,
    yellow: pc.yellow,
    blue: pc.blue,
    cyan: pc.cyan,
    dim: pc.dim,
};



async function bootstrap() {
    // Suppress NestJS logs
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
    const aiService = app.get(AiAnalysisService);

    // Use a fixed project ID for testing or random
    const projectId = "interactive-cli-" + Date.now();

    console.clear();
    intro(chalk.inverse(" 🔨 TheForge: Spec-Driven Generator (Interactive CLI) "));

    // 4. Pedir input inicial al usuario (Idea del proyecto)
    const initialIdea = await text({
        message: "Describe tu idea de software o requerimiento (lo más detallado posible):",
        placeholder: "Ej: Un 'Uber para paseadores de perros' con app móvil y panel admin...",
    });

    if (isCancel(initialIdea)) {
        outro("Operación cancelada.");
        process.exit(0);
    }

    // 5. Preguntar si desea Investigación Profunda (DBGA) o Directo a MDD
    const researchMode = await select({
        message: "¿Deseas realizar una Investigación Profunda (Deep Research) antes de diseñar?",
        options: [
            { value: "research", label: "🔍 Sí, investigar competidores y gaps (Recomendado)" },
            { value: "direct", label: "⏩ No, ir directo al MDD (Tengo los requisitos claros)" },
        ],
    });

    if (isCancel(researchMode)) {
        outro("Operación cancelada.");
        process.exit(0);
    }

    let dbgaContext = "";

    if (researchMode === "research") {
        // ... (existing logic)
    } else {
        // Direct mode: The "Idea" is the context
        dbgaContext = `Idea del usuario: ${initialIdea}\n\nINSTRUCCIÓN: Unificar el MDD. Usar PostgreSQL para users/sessions y FalkorDB para el grafo de código (Nodos/Aristas).`;
    }

    // 6. Iniciar el Loop Interactivo del MDD (Manager)
    const mddSpinner = spinner();
    mddSpinner.start("Inicializando Arquitectos de Software (Manager & Team)...");

    // NOTA: Pasamos empty initialMessage porque el Manager iniciará preguntando o usando el dbgaContext
    let mddStream: AsyncGenerator<StreamMddManagerEvent> = aiService.streamMddAnalysisWithManager(
        dbgaContext,
        projectId,
        researchMode === "direct" ? initialIdea.toString() : undefined // Si es directo, pasamos la idea como first prompt
    );

    let currentThreadId = "";
    let active = true;

    try {
        while (active) {
            let nextStream: AsyncGenerator<StreamMddManagerEvent> | undefined;
            let done = false;

            // Process current stream until interrupt or done
            for await (const event of mddStream) {
                if (event.type === "progress") {
                    mddSpinner.message(`[${event.agent}] ${event.message}`);
                } else if (event.type === "draft") {
                    // updates ignored in CLI to avoid noise
                } else if (event.type === "done") {
                    mddSpinner.stop("Generación MDD Completada");
                    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                    const filename = `MDD-${projectId}-${timestamp}.md`;
                    const filepath = path.join(process.cwd(), "docs", "generated", filename);

                    const dir = path.dirname(filepath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    fs.writeFileSync(filepath, event.markdown);
                    const absolutePath = path.resolve(filepath);
                    note(`Documento guardado en:\n${absolutePath}`, "✅ MDD Generado Exitosamente");
                    console.log(chalk.green(`\n📄 Archivo listo: ${absolutePath}`));
                    active = false;
                    done = true;
                    break;
                } else if (event.type === "error") {
                    mddSpinner.stop("Error");
                    console.error(chalk.red(event.message));
                    active = false;
                    done = true;
                    break;
                } else if (event.type === "interrupt") {
                    mddSpinner.stop();
                    currentThreadId = event.threadId;

                    // Calidad / Auditor Feedback
                    if (event.precision !== undefined) {
                        // Using console.log directly for better formatting than note
                        console.log(chalk.blue(`\n📊 Precisión Actual: ${event.precision}% | Status: ${event.status}`));
                        if (event.auditorFeedback) {
                            console.log(chalk.yellow(`📉 Feedback Auditor: ${event.auditorFeedback}`));
                        }
                    }

                    if (event.plan) {
                        console.log(chalk.cyan("\n📋 Plan Propuesto por el Manager:"));
                        event.plan.forEach((step: any) => console.log(`  - [${step.node}] ${step.task_description}`));
                        const approve = await select({
                            message: event.planMessage || "¿Apruebas este plan?",
                            options: [
                                { value: "yes", label: "👍 Sí, ejecutar plan" },
                                { value: "no", label: "✏️ No, quiero modificar algo" },
                            ],
                        });

                        if (isCancel(approve)) process.exit(0);

                        let answer: string;
                        if (approve === "yes") {
                            answer = "Plan Aprobado";
                        } else {
                            const feedback = await text({ message: "Indica tus correcciones:" });
                            if (isCancel(feedback)) process.exit(0);
                            answer = "Plan Rechazado. " + feedback;
                        }

                        nextStream = aiService.streamMddResume(projectId, currentThreadId, answer);
                        break; // break inner loop to resume
                    }
                    else if (event.questions && event.questions.length > 0) {
                        note(event.questions.join("\n"), "❓ Preguntas del Agente");
                        const ans = await text({ message: "Tu respuesta:" });
                        if (isCancel(ans)) process.exit(0);
                        nextStream = aiService.streamMddResume(projectId, currentThreadId, ans.toString());
                        break;
                    } else {
                        const ans = await text({ message: "El agente espera instrucciones. Escribe algo:" });
                        if (isCancel(ans)) process.exit(0);
                        nextStream = aiService.streamMddResume(projectId, currentThreadId, ans.toString());
                        break;
                    }
                }
            }

            if (done) break;
            if (nextStream) {
                mddStream = nextStream;
                mddSpinner.start("Reanudando...");
            } else {
                // Should not happen unless logic error
                break;
            }
        }
    } catch (error) {
        mddSpinner.stop("Error crítico");
        console.error(error);
    }

    outro("Sesión finalizada.");
    await app.close();
    process.exit(0);
}

bootstrap();
