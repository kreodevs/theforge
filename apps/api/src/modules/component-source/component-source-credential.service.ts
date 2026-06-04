import { Injectable } from "@nestjs/common";
import {
  ComponentSourceError,
  type ComponentSourceCredentialResolver,
  type ComponentSourceCredentials,
  type ComponentSourceHttpCredentials,
  type ComponentSourceStdioCredentials,
} from "@theforge/component-source";
import type { Prisma } from "@theforge/database";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TokenCryptoService } from "../crypto/token-crypto.service.js";

type EncryptedTokenFields = {
  tokenCipher: string | null;
  tokenKeyVersion: number | null;
};

type ProfileCredentialRow = {
  transportType: string;
  url: string;
  command: string | null;
  args: Prisma.JsonValue | null;
  cwd: string | null;
  tokenCipher: string | null;
  tokenKeyVersion: number | null;
};

@Injectable()
export class ComponentSourceCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  /** Resolver bound to a saved ComponentSourceProfile row. */
  createProfileResolver(profileId: string): ComponentSourceCredentialResolver {
    return async () => this.resolveFromProfile(profileId);
  }

  async resolveFromProfile(profileId: string): Promise<ComponentSourceCredentials> {
    const profile = await this.prisma.componentSourceProfile.findUnique({
      where: { id: profileId },
      select: {
        transportType: true,
        url: true,
        command: true,
        args: true,
        cwd: true,
        tokenCipher: true,
        tokenKeyVersion: true,
      },
    });
    if (!profile) {
      throw new ComponentSourceError("Perfil de fuente de componentes no encontrado");
    }
    return this.rowToCredentials(profile);
  }

  /** Saved or draft credentials for connection tests (profile UI / admin). */
  async resolveForTest(opts: {
    userId: string;
    profileId?: string;
    url?: string;
    token?: string;
    useSaved?: boolean;
    transportType?: "http" | "stdio";
    command?: string;
    args?: string[];
    cwd?: string;
  }): Promise<ComponentSourceCredentials> {
    const profileId = opts.profileId?.trim();
    const draftTransport = opts.transportType?.trim() as "http" | "stdio" | undefined;
    const draftCommand = opts.command?.trim();
    const draftUrl = opts.url?.trim();

    if (draftTransport === "stdio" || draftCommand) {
      if (!draftCommand) {
        throw new ComponentSourceError("El command es obligatorio para MCP stdio");
      }
      return {
        transport: "stdio",
        command: draftCommand,
        args: normalizeArgs(opts.args),
        ...(opts.cwd?.trim() ? { cwd: opts.cwd.trim() } : {}),
      };
    }

    if (profileId && opts.useSaved !== false && !draftUrl && !draftCommand) {
      return this.resolveFromProfile(profileId);
    }

    if (draftUrl) {
      let token = opts.token?.trim() ?? "";
      if (!token && profileId) {
        token = await this.resolveSavedProfileToken(profileId);
      }
      const http: ComponentSourceHttpCredentials = {
        transport: "http",
        url: draftUrl,
      };
      if (token) http.token = token;
      return http;
    }

    if (profileId) {
      return this.resolveFromProfile(profileId);
    }

    throw new ComponentSourceError(
      "Indica profileId, url (HTTP) o command (stdio) para probar la fuente de componentes",
    );
  }

  private rowToCredentials(profile: ProfileCredentialRow): ComponentSourceCredentials {
    const transport = profile.transportType?.trim() === "stdio" ? "stdio" : "http";

    if (transport === "stdio") {
      const command = profile.command?.trim();
      if (!command) {
        throw new ComponentSourceError("Perfil MCP stdio sin command configurado");
      }
      const stdio: ComponentSourceStdioCredentials = {
        transport: "stdio",
        command,
        args: parseStoredArgs(profile.args),
      };
      if (profile.cwd?.trim()) stdio.cwd = profile.cwd.trim();
      return stdio;
    }

    if (!profile.url?.trim()) {
      throw new ComponentSourceError("Perfil de fuente de componentes sin URL configurada");
    }
    const http: ComponentSourceHttpCredentials = {
      transport: "http",
      url: profile.url.trim(),
    };
    const token = this.decryptToken(profile);
    if (token) http.token = token;
    return http;
  }

  private async resolveSavedProfileToken(profileId: string): Promise<string> {
    const profile = await this.prisma.componentSourceProfile.findUnique({
      where: { id: profileId },
      select: {
        tokenCipher: true,
        tokenKeyVersion: true,
      },
    });
    return profile ? this.decryptToken(profile) : "";
  }

  private decryptToken(user: EncryptedTokenFields): string {
    if (user.tokenCipher && user.tokenKeyVersion != null) {
      return this.tokenCrypto.decrypt(user.tokenCipher, user.tokenKeyVersion);
    }
    return "";
  }
}

function parseStoredArgs(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function normalizeArgs(args: string[] | undefined): string[] {
  if (!args?.length) return [];
  return args.map((a) => a.trim()).filter(Boolean);
}
