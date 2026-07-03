/**
 * @fileoverview **UiMcpService** — CRUD de instancias team-wide de MCP gráfico (componentes UI) y
 * detección de compatibilidad contra el contrato definido por The Forge (`ui-mcp-contract`).
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@theforge/database";
import {
  DescribeCapabilitiesResult,
  UiMcpCompatibility,
  describeCapabilitiesResultSchema,
  evaluateUiMcpCompatibility,
} from "@theforge/shared-types";
import { isAdminOrAbove, isSuperAdmin } from "../../common/roles.js";
import { getRequestUserId, getRequestUserRole } from "../../common/request-user.store.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TokenCryptoService } from "../crypto/token-crypto.service.js";
import {
  UiMcpConnection,
  callUiMcpToolJson,
  listUiMcpTools,
} from "./ui-mcp-transport.util.js";
import { matchUiMcpAdapter } from "./adapters/ui-mcp-adapter.registry.js";
import type { UiMcpAdapter } from "./adapters/ui-mcp-adapter.types.js";

export interface UpsertUiMcpInstanceDto {
  displayName: string;
  url: string;
  /** Token M2M en claro (opcional). Vacío deja el existente al actualizar. */
  token?: string | null;
  enabled?: boolean;
  teamVisible?: boolean;
}

export type UpdateUiMcpInstanceDto = Partial<UpsertUiMcpInstanceDto>;

interface UiMcpInstanceRow {
  id: string;
  displayName: string;
  url: string;
  tokenCiphertext: string | null;
  tokenKeyVersion: number | null;
  enabled: boolean;
  isActive: boolean;
  teamVisible: boolean;
  compatible: boolean;
  adapterId: string | null;
  contractVersion: string | null;
  libraryName: string | null;
  libraryVersion: string | null;
  capabilitiesJson: unknown;
  lastCheckedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Vista pública (sin ciphertext) para la UI. */
function mapRow(row: UiMcpInstanceRow) {
  return {
    id: row.id,
    displayName: row.displayName,
    url: row.url,
    hasToken: !!row.tokenCiphertext,
    enabled: row.enabled,
    isActive: row.isActive,
    teamVisible: row.teamVisible,
    compatible: row.compatible,
    adapterId: row.adapterId,
    contractVersion: row.contractVersion,
    libraryName: row.libraryName,
    libraryVersion: row.libraryVersion,
    lastCheckedAt: row.lastCheckedAt,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class UiMcpService {
  private readonly logger = new Logger(UiMcpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  private assertCanManage(role = getRequestUserRole()) {
    if (!isAdminOrAbove(role)) {
      throw new ForbiddenException("Se requiere rol admin o super_admin");
    }
  }

  private assertCanMutate(row: { createdByUserId: string }, actorUserId: string, role: string) {
    if (isSuperAdmin(role)) return;
    if (row.createdByUserId !== actorUserId) {
      throw new ForbiddenException("Solo puedes modificar instancias que creaste");
    }
  }

  /** Todas las instancias visibles para gestión (admin: propias + team; super_admin: todas). */
  async listForManagement(actorUserId = getRequestUserId(), role = getRequestUserRole()) {
    this.assertCanManage(role);
    const where = isSuperAdmin(role)
      ? undefined
      : { OR: [{ createdByUserId: actorUserId }, { teamVisible: true }] };
    const rows = await this.prisma.uiMcpInstance.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    });
    return rows.map(mapRow);
  }

  async getById(id: string, actorUserId = getRequestUserId(), role = getRequestUserRole()) {
    this.assertCanManage(role);
    const row = await this.prisma.uiMcpInstance.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Instancia de MCP gráfico no encontrada");
    this.assertCanMutate(row, actorUserId, role);
    return mapRow(row);
  }

  private validateUpsert(displayName: string, url: string) {
    if (!displayName.trim()) throw new BadRequestException("El nombre para mostrar es obligatorio");
    const u = url.trim();
    if (!u) throw new BadRequestException("La URL del MCP es obligatoria");
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("protocolo no soportado");
      }
    } catch {
      throw new BadRequestException("La URL del MCP no es válida (usa http/https)");
    }
  }

  async create(dto: UpsertUiMcpInstanceDto, actorUserId = getRequestUserId()) {
    const role = getRequestUserRole();
    this.assertCanManage(role);
    this.validateUpsert(dto.displayName ?? "", dto.url ?? "");

    const token = dto.token?.trim() || undefined;
    let tokenCiphertext: string | null = null;
    let tokenKeyVersion: number | null = null;
    if (token) {
      const enc = this.tokenCrypto.encrypt(token);
      tokenCiphertext = enc.ciphertext;
      tokenKeyVersion = enc.keyVersion;
    }

    const row = await this.prisma.uiMcpInstance.create({
      data: {
        displayName: dto.displayName.trim(),
        url: dto.url.trim(),
        tokenCiphertext,
        tokenKeyVersion,
        enabled: dto.enabled ?? true,
        teamVisible: dto.teamVisible ?? true,
        createdByUserId: actorUserId,
      },
    });
    return mapRow(row);
  }

  async update(id: string, dto: UpdateUiMcpInstanceDto, actorUserId = getRequestUserId()) {
    const role = getRequestUserRole();
    this.assertCanManage(role);
    const existing = await this.prisma.uiMcpInstance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Instancia de MCP gráfico no encontrada");
    this.assertCanMutate(existing, actorUserId, role);

    const displayName = dto.displayName?.trim() ?? existing.displayName;
    const url = dto.url?.trim() ?? existing.url;
    this.validateUpsert(displayName, url);

    const data: Prisma.UiMcpInstanceUpdateInput = {
      displayName,
      url,
      enabled: dto.enabled ?? existing.enabled,
      teamVisible: dto.teamVisible ?? existing.teamVisible,
    };

    // URL o token cambiaron → invalidar compatibilidad detectada previamente.
    const urlChanged = url !== existing.url;
    const token = dto.token?.trim();
    if (token) {
      const enc = this.tokenCrypto.encrypt(token);
      data.tokenCiphertext = enc.ciphertext;
      data.tokenKeyVersion = enc.keyVersion;
    }
    if (urlChanged || token) {
      data.compatible = false;
      data.adapterId = null;
      data.contractVersion = null;
      data.libraryName = null;
      data.libraryVersion = null;
      data.capabilitiesJson = Prisma.DbNull;
      data.lastCheckedAt = null;
    }

    const row = await this.prisma.uiMcpInstance.update({ where: { id }, data });
    return mapRow(row);
  }

  async delete(id: string, actorUserId = getRequestUserId()) {
    const role = getRequestUserRole();
    this.assertCanManage(role);
    const existing = await this.prisma.uiMcpInstance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Instancia de MCP gráfico no encontrada");
    this.assertCanMutate(existing, actorUserId, role);
    await this.prisma.uiMcpInstance.delete({ where: { id } });
    return { ok: true };
  }

  /** Activa una instancia (desactiva las demás). Pasar `null` desactiva todas. */
  async setActive(id: string | null, actorUserId = getRequestUserId()) {
    const role = getRequestUserRole();
    this.assertCanManage(role);
    if (id) {
      const existing = await this.prisma.uiMcpInstance.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Instancia de MCP gráfico no encontrada");
      this.assertCanMutate(existing, actorUserId, role);
    }
    await this.prisma.uiMcpInstance.updateMany({
      where: id ? { NOT: { id } } : {},
      data: { isActive: false },
    });
    if (id) {
      await this.prisma.uiMcpInstance.update({ where: { id }, data: { isActive: true } });
    }
    return { ok: true, activeId: id };
  }

  /**
   * Detecta compatibilidad de un MCP arbitrario (URL/token en claro, sin persistir).
   * 1. Contrato nativo The Forge (`describe_capabilities` + tools obligatorios).
   * 2. Si falla, intenta un adaptador genérico por `tools/list` (p. ej. Kreo UI MCP).
   */
  async detectCompatibility(url: string, token?: string | null): Promise<UiMcpCompatibility> {
    const conn: UiMcpConnection = { url, token };
    let toolNames: string[] = [];
    try {
      toolNames = await listUiMcpTools(conn);
    } catch (err) {
      return {
        compatible: false,
        missingTools: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
    let capabilities: DescribeCapabilitiesResult | null = null;
    try {
      const raw = await callUiMcpToolJson(conn, "describe_capabilities", {});
      if (raw) capabilities = describeCapabilitiesResultSchema.parse(raw);
    } catch (err) {
      this.logger.debug(
        `[UiMcp] describe_capabilities nativo no disponible: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const native = evaluateUiMcpCompatibility({ toolNames, capabilities });
    if (native.compatible) {
      return { ...native, adapterId: null, nativeCompatible: true, detectedTools: toolNames };
    }

    const adapter = matchUiMcpAdapter(toolNames);
    if (!adapter) return { ...native, detectedTools: toolNames };

    try {
      const adaptedCaps = await adapter.describeCapabilities(conn);
      return {
        compatible: true,
        adapterId: adapter.id,
        nativeCompatible: false,
        contractVersion: adaptedCaps.contractVersion,
        libraryName: adaptedCaps.componentLibrary.name,
        libraryVersion: adaptedCaps.componentLibrary.version,
        supports: adaptedCaps.supports,
        missingTools: [],
        detectedTools: toolNames,
      };
    } catch (err) {
      return {
        compatible: false,
        adapterId: adapter.id,
        nativeCompatible: false,
        missingTools: native.missingTools,
        detectedTools: toolNames,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Detecta compatibilidad de una instancia guardada y persiste el resultado. */
  async detectAndPersist(id: string, actorUserId = getRequestUserId()) {
    const role = getRequestUserRole();
    this.assertCanManage(role);
    const existing = await this.prisma.uiMcpInstance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Instancia de MCP gráfico no encontrada");
    this.assertCanMutate(existing, actorUserId, role);

    const token = existing.tokenCiphertext
      ? this.tokenCrypto.decrypt(existing.tokenCiphertext, existing.tokenKeyVersion ?? 1)
      : undefined;
    const result = await this.detectCompatibility(existing.url, token);

    const row = await this.prisma.uiMcpInstance.update({
      where: { id },
      data: {
        compatible: result.compatible,
        adapterId: result.adapterId ?? null,
        contractVersion: result.contractVersion ?? null,
        libraryName: result.libraryName ?? null,
        libraryVersion: result.libraryVersion ?? null,
        capabilitiesJson: (result as unknown as Prisma.InputJsonValue) ?? Prisma.DbNull,
        lastCheckedAt: new Date(),
      },
    });
    return { ...mapRow(row), detection: result };
  }

  /**
   * Conexión de la instancia **activa, habilitada y compatible** (token descifrado), o `null`.
   * Este es el gate único que usa el pipeline de generación para decidir MCP vs heurístico.
   */
  async getActiveCompatibleConnection(): Promise<{
    connection: UiMcpConnection;
    supports: { resolveComponent: boolean; listScreens: boolean; designTokens: boolean };
    adapter: UiMcpAdapter | null;
  } | null> {
    const row = await this.prisma.uiMcpInstance.findFirst({
      where: { isActive: true, enabled: true, compatible: true },
    });
    if (!row) return null;
    const token = row.tokenCiphertext
      ? this.tokenCrypto.decrypt(row.tokenCiphertext, row.tokenKeyVersion ?? 1)
      : undefined;
    const caps = this.readSupports(row.capabilitiesJson);
    const adapter = row.adapterId ? this.resolveAdapterById(row.adapterId, row.capabilitiesJson) : null;
    return { connection: { url: row.url, token }, supports: caps, adapter };
  }

  private resolveAdapterById(adapterId: string, capabilitiesJson: unknown): UiMcpAdapter | null {
    if (adapterId !== "kreo") return null;
    const toolNames = this.readDetectedToolNames(capabilitiesJson);
    return matchUiMcpAdapter(toolNames.length > 0 ? toolNames : ["resolve_component_for_entity", "get_ui_component_catalog"]);
  }

  private readDetectedToolNames(capabilitiesJson: unknown): string[] {
    if (!capabilitiesJson || typeof capabilitiesJson !== "object") return [];
    const tools = (capabilitiesJson as { detectedTools?: unknown }).detectedTools;
    return Array.isArray(tools) ? tools.filter((t): t is string => typeof t === "string") : [];
  }

  /** Metadatos (librería/versión/contrato) de la instancia activa compatible, o `null`. */
  async getActiveCompatibleMeta(): Promise<{
    libraryName: string | null;
    libraryVersion: string | null;
    contractVersion: string | null;
  } | null> {
    const row = await this.prisma.uiMcpInstance.findFirst({
      where: { isActive: true, enabled: true, compatible: true },
      select: { libraryName: true, libraryVersion: true, contractVersion: true },
    });
    return row ?? null;
  }

  /** Indica si hay un MCP gráfico compatible activo (para feature-gating de UI/deliverables). */
  async hasActiveCompatible(): Promise<boolean> {
    const count = await this.prisma.uiMcpInstance.count({
      where: { isActive: true, enabled: true, compatible: true },
    });
    return count > 0;
  }

  private readSupports(capabilitiesJson: unknown): {
    resolveComponent: boolean;
    listScreens: boolean;
    designTokens: boolean;
  } {
    const fallback = { resolveComponent: true, listScreens: false, designTokens: false };
    if (!capabilitiesJson || typeof capabilitiesJson !== "object") return fallback;
    const supports = (capabilitiesJson as { supports?: unknown }).supports;
    if (!supports || typeof supports !== "object") return fallback;
    const s = supports as Record<string, unknown>;
    return {
      resolveComponent: s.resolveComponent !== false,
      listScreens: s.listScreens === true,
      designTokens: s.designTokens === true,
    };
  }
}
