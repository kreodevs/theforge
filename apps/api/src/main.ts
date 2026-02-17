import { config } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

// Cargar .env de la raíz del repo (turbo ejecuta con cwd = apps/api) y luego local
config({ path: resolve(process.cwd(), "../../.env") });
config();

// Evitar MaxListenersExceededWarning cuando streams/LLM añaden múltiples abort listeners
import { EventEmitter } from "node:events";
import { json, urlencoded } from "express";

EventEmitter.defaultMaxListeners = 20;
if (typeof process.setMaxListeners === "function") process.setMaxListeners(20);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  // Increase body size limit for MDD content
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
