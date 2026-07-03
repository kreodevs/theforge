/**
 * @fileoverview Endpoints REST de instancias de **MCP gráfico** (componentes UI).
 * CRUD + activación + detección de compatibilidad. Requiere rol admin/super_admin salvo el gate `active`.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { requireAdmin } from "../../common/guards/role.helpers.js";
import {
  UiMcpService,
  type UpdateUiMcpInstanceDto,
  type UpsertUiMcpInstanceDto,
} from "./ui-mcp.service.js";

@Controller("ui-mcp")
export class UiMcpController {
  constructor(private readonly uiMcp: UiMcpService) {}

  /** Gate para UI/deliverables: ¿hay MCP gráfico compatible activo? (cualquier rol autenticado). */
  @Get("active")
  async active() {
    return { hasActiveCompatible: await this.uiMcp.hasActiveCompatible() };
  }

  @Get()
  list() {
    requireAdmin();
    return this.uiMcp.listForManagement();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    requireAdmin();
    return this.uiMcp.getById(id);
  }

  @Post()
  create(@Body() body: UpsertUiMcpInstanceDto) {
    requireAdmin();
    return this.uiMcp.create(body);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: UpdateUiMcpInstanceDto) {
    requireAdmin();
    return this.uiMcp.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    requireAdmin();
    return this.uiMcp.delete(id);
  }

  /** Activa (o desactiva con `{ active: false }`) una instancia. */
  @Post(":id/activate")
  activate(@Param("id") id: string, @Body() body: { active?: boolean }) {
    requireAdmin();
    return this.uiMcp.setActive(body?.active === false ? null : id);
  }

  /** Detecta compatibilidad de una instancia guardada y persiste el resultado. */
  @Post(":id/detect")
  detect(@Param("id") id: string) {
    requireAdmin();
    return this.uiMcp.detectAndPersist(id);
  }

  /** Prueba/detecta compatibilidad de una URL/token arbitrarios sin persistir (patrón ariadne-config/test). */
  @Post("test")
  test(@Body() body: { url: string; token?: string | null }) {
    requireAdmin();
    return this.uiMcp.detectCompatibility(body?.url ?? "", body?.token ?? undefined);
  }
}
