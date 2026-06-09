import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomInt, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service.js";
import { isSuperAdmin } from "../../common/roles.js";
import { UserProvidersService } from "../user-providers/user-providers.service.js";
import { buildOtpEmailContent } from "./otp-email.template.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;

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

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** 1|true|yes|on — devuelve el OTP en la respuesta sin enviar correo. Con 0 u omitido, se envía email si hay SMTP. */
function otpDevExposeCode(): boolean {
  const v = stripEnvQuotes(process.env.OTP_DEV_EXPOSE_CODE);
  if (!v) return false;
  const n = v.toLowerCase();
  return n === "1" || n === "true" || n === "yes" || n === "on";
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpByEmail = new Map<string, { code: string; expiresAt: number }>();
  private readonly lastOtpRequestAt = new Map<string, number>();
  private transporter: nodemailer.Transporter | null | undefined;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly userProviders: UserProvidersService,
  ) {}

  private smtpConfig():
    | { host: string; port: number; secure: boolean; user: string; pass: string }
    | null {
    const host = stripEnvQuotes(this.config.get<string>("SMTP_HOST"));
    if (!host) return null;
    const port = Number(stripEnvQuotes(this.config.get<string>("SMTP_PORT")) ?? "587") || 587;
    const secure = this.config.get<string>("SMTP_SECURE") === "1";
    const user = stripEnvQuotes(this.config.get<string>("SMTP_USER")) ?? "";
    const pass = stripEnvQuotes(this.config.get<string>("SMTP_PASS")) ?? "";
    if (!user || !pass) return null;
    return { host, port, secure, user, pass };
  }

  /** Gmail / Google Workspace SMTP hosts — used for From + password quirks. */
  private isGoogleSmtpHost(host: string): boolean {
    const h = host.toLowerCase();
    return h.includes("gmail.com") || h.includes("googlemail.com");
  }

  /**
   * Gmail app passwords are often pasted as "xxxx xxxx xxxx xxxx"; SMTP auth expects 16 chars without spaces.
   */
  private normalizeSmtpPassword(pass: string, host: string): string {
    if (this.isGoogleSmtpHost(host)) return pass.replace(/\s+/g, "");
    return pass;
  }

  /**
   * STARTTLS (587) must use secure=false; SSL (465) must use secure=true.
   * Mis-set SMTP_SECURE with port 587 breaks TLS negotiation with many providers (including Gmail).
   */
  private resolveSmtpTls(port: number, secureFromEnv: boolean): { port: number; secure: boolean } {
    if (port === 587) return { port, secure: false };
    if (port === 465) return { port, secure: true };
    return { port, secure: secureFromEnv };
  }

  private smtpTransport(): nodemailer.Transporter | null {
    if (this.transporter === undefined) {
      const cfg = this.smtpConfig();
      if (!cfg) {
        this.transporter = null;
        return null;
      }
      const pass = this.normalizeSmtpPassword(cfg.pass, cfg.host);
      const { port, secure } = this.resolveSmtpTls(cfg.port, cfg.secure);
      if (cfg.port === 587 && cfg.secure) {
        this.logger.warn(
          "SMTP: puerto 587 implica STARTTLS (secure=false). Se fuerza secure=false; revise SMTP_SECURE en .env.",
        );
      }
      if (cfg.port === 465 && !cfg.secure) {
        this.logger.warn(
          "SMTP: puerto 465 suele usar SSL directo (secure=true). Se fuerza secure=true; revise SMTP_SECURE.",
        );
      }

      this.transporter = nodemailer.createTransport({
        host: cfg.host,
        port,
        secure,
        auth: { user: cfg.user, pass },
        tls: { minVersion: "TLSv1.2" },
        connectionTimeout: 25_000,
        greetingTimeout: 25_000,
        socketTimeout: 25_000,
        ...(!secure && port === 587 && this.isGoogleSmtpHost(cfg.host)
          ? // Gmail expects STARTTLS on 587; some other hosts reject strict requireTLS.
            { requireTLS: true as const }
          : {}),
      });
    }
    return this.transporter;
  }

  /**
   * Cabecera From: si SMTP_FROM no incluye @, se usa SMTP_USER como dirección.
   * Gmail SMTP solo acepta envío como la cuenta autenticada (o alias verificado); si SMTP_FROM es otro correo, se ignora.
   */
  private mailFromHeader(): string {
    const cfg = this.smtpConfig();
    const user = cfg?.user ?? stripEnvQuotes(this.config.get<string>("SMTP_USER")) ?? "";
    const raw = stripEnvQuotes(this.config.get<string>("SMTP_FROM"));
    const display = raw?.trim() ?? "";
    const host = cfg?.host ?? "";

    if (user && cfg && this.isGoogleSmtpHost(host)) {
      if (!display) return `The Forge <${user}>`;
      if (!display.includes("@")) return `"${display.replace(/"/g, "")}" <${user}>`;
      const emailMatch = display.match(/[\w.+-]+@[\w.-]+\.\w+/i);
      const fromAddr = emailMatch ? emailMatch[0].toLowerCase() : "";
      if (fromAddr && fromAddr === user.toLowerCase()) return display;
      this.logger.warn(
        `SMTP_FROM no coincide con SMTP_USER en Gmail; se envía como The Forge <${user}> para evitar rechazo.`,
      );
      return `The Forge <${user}>`;
    }

    if (!display) {
      return user ? `The Forge <${user}>` : "The Forge <noreply@localhost>";
    }
    if (display.includes("@")) return display;
    if (user) return `"${display.replace(/"/g, "")}" <${user}>`;
    return display;
  }

  /**
   * URL pública del front para enlaces del correo OTP.
   * Usa WEB_DOMAIN si existe; si no, el primer origen de CORS_ORIGINS (sin env extra).
   */
  private resolveWebAppBaseUrl(): string | null {
    const webDomain = stripEnvQuotes(this.config.get<string>("WEB_DOMAIN"))?.trim();
    if (webDomain) {
      const normalized = webDomain.replace(/\/$/, "");
      if (/^https?:\/\//i.test(normalized)) return normalized;
      return `https://${normalized}`;
    }

    const cors =
      stripEnvQuotes(this.config.get<string>("CORS_ORIGINS"))?.trim() ??
      stripEnvQuotes(process.env.CORS_ORIGINS)?.trim();
    if (cors) {
      for (const part of cors.split(",")) {
        const origin = part.trim().replace(/\/$/, "");
        if (!origin) continue;
        if (/^https?:\/\//i.test(origin)) return origin;
        return `https://${origin}`;
      }
    }

    if (!isProduction()) return "http://localhost:5173";
    return null;
  }

  /**
   * Solicitud de OTP. El email viene del request; solo se envía si existe un usuario registrado con ese email.
   * Si no existe, devuelve ok igualmente (anti-enumeración).
   */
  async requestOtp(rawEmail: string): Promise<{ ok: true; devCode?: string }> {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      throw new BadRequestException("email requerido");
    }

    try {
      // Anti-enumeración: si el usuario no existe, devolvemos ok sin enviar nada.
      const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) {
        this.logger.warn(`OTP solicitado para email no registrado: ${email}`);
        return { ok: true };
      }

      const now = Date.now();
      const last = this.lastOtpRequestAt.get(email) ?? 0;
      if (now - last < OTP_RESEND_MS) {
        return { ok: true };
      }

      if (isProduction() && !this.smtpConfig()) {
        this.logger.error(
          "SMTP_HOST, SMTP_USER y SMTP_PASS deben estar definidos en producción para OTP",
        );
        throw new ServiceUnavailableException("Envío de correo no disponible");
      }

      const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      this.otpByEmail.set(email, { code, expiresAt: now + OTP_TTL_MS });
      this.lastOtpRequestAt.set(email, now);

      if (otpDevExposeCode()) {
        this.logger.warn(
          `OTP_DEV_EXPOSE_CODE activo: código para ${email} (no se envía correo)`,
        );
        return { ok: true, devCode: code };
      }

      const transport = this.smtpTransport();
      if (!transport) {
        if (isProduction()) {
          this.logger.error(
            "SMTP no configurado y OTP_DEV_EXPOSE_CODE=0: no se puede enviar el código",
          );
          throw new ServiceUnavailableException("Envío de correo no disponible");
        }
        this.logger.warn(
          `OTP para ${email}: configure SMTP o OTP_DEV_EXPOSE_CODE=1 para desarrollo`,
        );
        throw new ServiceUnavailableException(
          "Envío de correo no disponible. Configure SMTP o OTP_DEV_EXPOSE_CODE=1 en desarrollo.",
        );
      }

      const from = this.mailFromHeader();
      const appBaseUrl = this.resolveWebAppBaseUrl();
      const { subject, text, html } = buildOtpEmailContent({
        code,
        email,
        appBaseUrl,
      });

      try {
        const info = await transport.sendMail({
          from,
          to: email,
          subject,
          text,
          html,
          headers: {
            "X-Priority": "1",
            Importance: "high",
            "X-Auto-Response-Suppress": "All",
          },
        });
        const messageId =
          typeof info.messageId === "string" ? info.messageId : String(info.messageId ?? "");
        this.logger.log(
          `OTP enviado por SMTP a ${email}${messageId ? ` (messageId=${messageId})` : ""}`,
        );
      } catch (err) {
        this.otpByEmail.delete(email);
        this.lastOtpRequestAt.delete(email);
        const e = err as Error & { responseCode?: number | string; response?: string; command?: string };
        const detail = [e.message, e.responseCode, e.response].filter(Boolean).join(" | ");
        this.logger.error(`Fallo SMTP al enviar OTP: ${detail || String(err)}`);
        throw new ServiceUnavailableException("No se pudo enviar el código por correo");
      }

      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`requestOtp falló antes/después de SMTP: ${msg}`, err instanceof Error ? err.stack : undefined);
      throw new InternalServerErrorException(
        isProduction()
          ? "Error interno al solicitar el código. Revisa que la API tenga DATABASE_URL y SMTP correctos (logs del servidor)."
          : `Error al solicitar código: ${msg}`,
      );
    }
  }

  async verifyOtp(rawEmail: string, rawCode: string): Promise<{
    accessToken: string;
    user: { id: string; email: string; role: string };
  }> {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      throw new BadRequestException("email requerido");
    }
    const code = rawCode.replace(/\D/g, "").trim();

    const entry = this.otpByEmail.get(email);
    if (!entry || Date.now() > entry.expiresAt || entry.code !== code) {
      throw new UnauthorizedException("Código o correo inválido");
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("Código o correo inválido");
    }

    this.otpByEmail.delete(email);

    // Generar mcpSecret automático si no existe (primera vez) — NO ROMPER
    if (!user.mcpSecret) {
      const mcpSecret = randomBytes(32).toString("hex");
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mcpSecret },
      });
      this.logger.log(`MCP secret generado automáticamente para ${email}`);
    }

    // Usar el role real del usuario desde la DB
    const userRole = user.role ?? "developer";

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: userRole,
      name: user.name ?? undefined,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: userRole },
    };
  }

  /**
   * MCP M2M login: intercambia un secreto de usuario por un JWT con el userId real.
   * Cada usuario tiene su propio mcpSecret en la tabla User, que puede ver y rotar desde la UI.
   */
  async mcpLogin(secret: string): Promise<{ accessToken: string; user: { id: string; email: string; role: string } }> {
    const user = await this.prisma.user.findUnique({
      where: { mcpSecret: secret },
    });
    if (!user) {
      throw new UnauthorizedException("Secreto MCP inválido");
    }
    const userRole = user.role ?? "developer";
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: userRole,
      name: user.name ?? undefined,
    });
    return {
      accessToken,
      user: { id: user.id, email: user.email, role: userRole },
    };
  }

  async getMcpSecret(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mcpSecret: true, email: true },
    });
    if (!user) throw new UnauthorizedException("Usuario no encontrado");
    // Si no tiene secret, generarlo automáticamente
    if (!user.mcpSecret) {
      const { mcpSecret } = await this.regenerateMcpSecret(userId);
      return {
        message: "Se generó un nuevo secret para tu cuenta. Guárdalo de inmediato.",
        mcpSecret,
        email: user.email,
      };
    }
    return { mcpSecret: user.mcpSecret, email: user.email };
  }

  async regenerateMcpSecret(userId: string) {
    const mcpSecret = randomBytes(32).toString("hex");

    await this.prisma.user.update({
      where: { id: userId },
      data: { mcpSecret },
    });

    this.logger.log(`MCP secret regenerado para usuario ${userId}`);
    return { mcpSecret };
  }

  /** Obtiene la URL y token del MCP de Ariadne configurados por el usuario. */
  async getAriadneConfig(userId: string): Promise<{ url: string; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ariadneMcpUrl: true, ariadneMcpToken: true },
    });
    return { url: user?.ariadneMcpUrl ?? "", token: user?.ariadneMcpToken ?? "" };
  }

  /** Guarda la URL y token del MCP de Ariadne para el usuario. */
  async setAriadneConfig(userId: string, url: string, token: string): Promise<{ ok: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ariadneMcpUrl: url.trim() || null,
        ariadneMcpToken: token.trim() || null,
      },
    });
    this.logger.log(`Ariadne MCP config actualizada para usuario ${userId}`);
    return { ok: true };
  }

  // ─── SSO ───

  /**
   * Login via SSO externo.
   * Valida el token contra SSO_URL/verify, crea/actualiza usuario local y emite JWT.
   */
  async ssoLogin(ssoToken: string): Promise<{
    accessToken: string;
    user: { id: string; email: string; role: string; name: string | null };
    ssoUrl?: string;
  }> {
    const ssoUrl = stripEnvQuotes(this.config.get<string>("SSO_URL"));
    if (!ssoUrl) {
      throw new BadRequestException("SSO no configurado (SSO_URL)");
    }

    const verifyUrl = `${ssoUrl.replace(/\/$/, "")}/verify`;
    const ssoRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ssoToken }),
    });

    if (!ssoRes.ok) {
      throw new UnauthorizedException("Token SSO inválido");
    }

    const ssoData = (await ssoRes.json()) as {
      email?: string;
      role?: string;
      name?: string;
    };

    if (!ssoData?.email) {
      throw new BadRequestException("SSO no devolvió email");
    }

    const email = ssoData.email.trim().toLowerCase();
    const role = ssoData.role === "admin" ? "admin" : "developer";
    const name = ssoData.name?.trim() || null;

    // Crear o actualizar usuario local
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, name, role },
      update: { name, role },
    });

    // Asegurar mcpSecret (NO ROMPER)
    if (!user.mcpSecret) {
      const mcpSecret = randomBytes(32).toString("hex");
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mcpSecret },
      });
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? undefined,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
      ssoUrl,
    };
  }

  // ─── Users CRUD ───

  /** Obtener perfil del usuario autenticado. */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, name: true, mcpSecret: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      hasMcpSecret: !!user.mcpSecret,
      createdAt: user.createdAt,
    };
  }

  /** Listar todos los usuarios (admin-only). super_admin recibe grants de modelos. */
  async listUsers(actorRole: string) {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        mcpSecret: true,
        createdAt: true,
        ...(isSuperAdmin(actorRole)
          ? {
              aiSettings: {
                select: {
                  allowedChatModels: true,
                  activeTenantInstanceId: true,
                },
              },
            }
          : {}),
      },
    });
    const mapped = users.map((u) => {
      const base = {
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.name,
        hasMcpSecret: !!u.mcpSecret,
        createdAt: u.createdAt,
      };
      if (!isSuperAdmin(actorRole)) return base;
      const settings = (u as {
        aiSettings?: {
          allowedChatModels: string[];
          activeTenantInstanceId: string | null;
        } | null;
      }).aiSettings;
      return {
        ...base,
        allowedChatModels: settings?.allowedChatModels ?? [],
      };
    });
    if (!isSuperAdmin(actorRole)) return mapped;

    const assignableChatModels = await this.userProviders.buildGlobalGrantAssignableChatModels();
    const enriched = await Promise.all(
      mapped.map(async (row) => {
        const grants = await this.userProviders.getUserChatModelGrants(row.id);
        return {
          ...row,
          allowedChatModels: grants.allowedChatModels,
        };
      }),
    );
    return { users: enriched, assignableChatModels };
  }

  /** Obtener mcpSecret de cualquier usuario (admin-only). Genera uno si falta. */
  async getUserMcpSecretAdmin(userId: string): Promise<{ mcpSecret: string; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mcpSecret: true, email: true },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    if (!user.mcpSecret) {
      const mcpSecret = this.generateMcpSecret();
      await this.prisma.user.update({ where: { id: userId }, data: { mcpSecret } });
      this.logger.log(`MCP secret generado por admin para usuario ${userId}`);
      return { mcpSecret, email: user.email };
    }
    return { mcpSecret: user.mcpSecret, email: user.email };
  }

  /** Regenerar mcpSecret de cualquier usuario (admin-only). */
  async regenerateUserMcpSecretAdmin(userId: string): Promise<{ mcpSecret: string; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    const mcpSecret = this.generateMcpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mcpSecret } });
    this.logger.log(`MCP secret regenerado por admin para usuario ${userId}`);
    return { mcpSecret, email: user.email };
  }

  /** Cambiar rol de un usuario (admin-only). No permite degradarse a sí mismo (developer). */
  async updateUserRole(targetUserId: string, role: string, actorUserId: string) {
    if (role !== "admin" && role !== "developer" && role !== "super_admin") {
      throw new BadRequestException("Rol inválido. Use 'super_admin', 'admin' o 'developer'.");
    }
    if (targetUserId === actorUserId && role === "developer") {
      throw new ForbiddenException("No puedes degradar tu propio rol de administrador");
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("Usuario no encontrado");

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
    });

    return { id: targetUserId, email: user.email, role };
  }

  /** GET /auth/has-users — verifica si hay usuarios registrados. */
  async hasUsers(): Promise<{ hasUsers: boolean }> {
    const count = await this.prisma.user.count();
    return { hasUsers: count > 0 };
  }

  /** POST /auth/register-first-admin — crea el primer admin. */
  async registerFirstAdmin(
    email: string,
    name?: string,
  ): Promise<{
    created: boolean;
    message: string;
    user?: { id: string; email: string; role: string };
    /** Solo al crear el primer admin: permite entrar sin correo vía MCP. */
    mcpSecret?: string;
  }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.count();
    if (existing > 0) {
      return { created: false, message: "Ya existen usuarios registrados" };
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalized,
          name: name?.trim() || null,
          role: "super_admin",
          mcpSecret: this.generateMcpSecret(),
        },
      });
      return {
        created: true,
        message: "Administrador creado exitosamente",
        user: { id: user.id, email: user.email, role: user.role },
        mcpSecret: user.mcpSecret ?? undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      return { created: false, message: msg };
    }
  }

  private generateMcpSecret(): string {
    return randomBytes(32).toString("hex");
  }

  /** POST /users — crear usuario manualmente (admin). */
  async createUser(
    email: string,
    name?: string,
    role?: string,
  ): Promise<{ id: string; email: string; role: string }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      throw new BadRequestException("El email ya está registrado");
    }
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        name: name?.trim() || null,
        role:
          role === "super_admin" || role === "admin" ? role : "developer",
        mcpSecret: this.generateMcpSecret(),
      },
    });
    return { id: user.id, email: user.email, role: user.role };
  }

  /** DELETE /users/:id — eliminar usuario (admin). No permite borrar la propia cuenta. */
  async deleteUser(targetUserId: string, actorUserId: string): Promise<{ deleted: boolean }> {
    if (targetUserId === actorUserId) {
      throw new ForbiddenException("No puedes eliminar tu propia cuenta");
    }
    try {
      await this.prisma.user.delete({ where: { id: targetUserId } });
      return { deleted: true };
    } catch {
      throw new NotFoundException("Usuario no encontrado");
    }
  }
}
