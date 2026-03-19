import { Controller, Get } from "@nestjs/common";

/** Endpoint ligero para healthcheck de Docker/Dokploy (sin depender de DB). */
@Controller()
export class HealthController {
  @Get("health")
  health() {
    return { status: "ok" };
  }
}
